"""Проверяет HTTP-вход и границу доверия proxy на настоящем nginx в Docker."""
import json
import os
import re
from pathlib import Path
import subprocess
import tempfile
import time
import unittest
import uuid

IMAGE = os.environ.get('NGINX_TEST_IMAGE', 'fm-ui:nginx-test')
CLIENT_IMAGE = 'python:3.13-alpine'
REQUEST = '''
import json, sys, urllib.request, urllib.error
class NoRedirect(urllib.request.HTTPRedirectHandler):
    """Позволяет проверить Location без автоматического перехода."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        """Возвращает исходный ответ с перенаправлением вызывающему тесту."""
        return None
url, headers = sys.argv[1:]
request = urllib.request.Request(url, headers=json.loads(headers))
try:
    response = urllib.request.build_opener(NoRedirect).open(request, timeout=5)
except urllib.error.HTTPError as error:
    response = error
print(json.dumps({'status': response.status, 'body': response.read().decode(),
                  'url': response.url, 'location': response.headers.get('Location')}))
'''


def docker(*args, check=True):
    """Вызывает Docker с ограничением времени и сохраняет диагностику ошибок."""
    return subprocess.run(['docker', *args], check=check, text=True,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=120)


class NginxHTTPTest(unittest.TestCase):
    """Проверяет реальный образ приложения в изолированной сети без сертификатов."""

    @classmethod
    def setUpClass(cls):
        """Создаёт клиентов, HTTP-бэкенд и контейнер приложения с адресным доверием."""
        cls.prefix = 'fm122-' + uuid.uuid4().hex[:10]
        cls.containers = []
        cls.temp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.cleanup)
        docker('network', 'create', cls.prefix)
        for suffix in ('trusted', 'direct'):
            name = cls.prefix + '-' + suffix
            cls.containers.append(name)
            docker('run', '-d', '--name', name, '--network', cls.prefix,
                   CLIENT_IMAGE, 'sleep', '300')
        address = docker('inspect', '-f', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}',
                         cls.prefix + '-trusted').stdout.strip()
        trusted = Path(cls.temp.name) / 'trusted-proxies.conf'
        trusted.write_text(address + '/32 1;\n')
        backend = Path(cls.temp.name) / 'backend.conf'
        backend.write_text('''events {}\nhttp { server { listen 80; location / {
            default_type application/json;
            return 200 '{"uri":"$request_uri","host":"$http_host","proto":"$http_x_forwarded_proto","forwarded":"$http_forwarded","forwarded_host":"$http_x_forwarded_host"}';
        } } }\n''')
        name = cls.prefix + '-backend'
        cls.containers.append(name)
        docker('run', '-d', '--name', name, '--network', cls.prefix,
               '--network-alias', 'fm_auth_service', '--network-alias', 'fm_transaction_service',
               '-v', f'{backend}:/etc/nginx/nginx.conf:ro', 'nginx:1.29.2')
        name = cls.prefix + '-ui'
        cls.containers.append(name)
        docker('run', '-d', '--name', name, '--network', cls.prefix, '--network-alias', 'ui',
               '-v', f'{trusted}:/etc/nginx/trusted-proxies.conf:ro', IMAGE)
        for _ in range(30):
            result = docker('exec', name, 'nginx', '-t', check=False)
            if result.returncode == 0:
                return
            state = docker('inspect', '-f', '{{.State.Running}}', name).stdout.strip()
            if state == 'false':
                break
            time.sleep(0.2)
        raise AssertionError('Образ должен запускаться без сертификатов:\n' +
                             docker('logs', name).stdout)

    @classmethod
    def cleanup(cls):
        """Удаляет только ресурсы, созданные текущим запуском теста."""
        for name in reversed(cls.containers):
            docker('rm', '-f', name, check=False)
        docker('network', 'rm', cls.prefix, check=False)
        cls.temp.cleanup()

    def request(self, path, trusted=False, headers=None):
        """Посылает HTTP-запрос из доверенного либо постороннего контейнера."""
        client = self.prefix + ('-trusted' if trusted else '-direct')
        return json.loads(docker('exec', client, 'python', '-c', REQUEST,
                                 'http://ui' + path, json.dumps(headers or {})).stdout)

    def test_spa_assets_and_relative_redirects(self):
        """Проверяет SPA, реальные ресурсы, 404 и отсутствие HTTP-редиректа наружу."""
        index = self.request('/')
        self.assertEqual(index['status'], 200)
        self.assertIn('<div id="app">', index['body'])
        self.assertEqual(self.request('/planning/nested')['body'], index['body'])
        self.assertEqual(self.request('/assets/missing-chunk.js')['status'], 404)
        asset = re.search(r'src="(/assets/[^\"]+\.js)"', index['body']).group(1)
        self.assertEqual(self.request(asset)['status'], 200)
        # /auth без слеша вызывает встроенное перенаправление nginx.
        redirect = self.request('/auth', trusted=True, headers={
            'Host': 'budget.example:8443', 'X-Forwarded-Proto': 'https'})
        self.assertEqual(redirect['status'], 301)
        self.assertEqual(redirect['location'], '/auth/')

    def test_api_preserves_paths_host_and_trusted_scheme(self):
        """Проверяет все API location, включая импорт, без потери префикса и Host."""
        for path in ('/auth/me?x=1', '/transaction/category',
                     '/transaction/import-export/imports/income',
                     '/transaction/import-export/imports/outcome'):
            with self.subTest(path=path):
                response = self.request(path, trusted=True, headers={
                    'Host': 'budget.example:8443', 'X-Forwarded-Proto': 'https',
                    'X-Forwarded-Host': 'attacker.example', 'Forwarded': 'proto=http'})
                self.assertEqual(response['status'], 200)
                self.assertEqual(json.loads(response['body']), {
                    'uri': path, 'host': 'budget.example:8443', 'proto': 'https',
                    'forwarded': '', 'forwarded_host': 'budget.example:8443'})

    def test_untrusted_and_invalid_scheme_cannot_spoof_https(self):
        """Отбрасывает поддельную схему постороннего клиента и неоднозначные значения."""
        for trusted, scheme in ((False, 'https'), (True, 'https,http'),
                                (True, 'ftp'), (True, ''), (True, 'http')):
            with self.subTest(trusted=trusted, scheme=scheme):
                response = self.request('/auth/me', trusted=trusted, headers={
                    'X-Forwarded-Proto': scheme, 'Forwarded': 'proto=https'})
                body = json.loads(response['body'])
                self.assertEqual(body['proto'], 'http')
                self.assertEqual(body['forwarded'], '')


if __name__ == '__main__':
    unittest.main()
