"""Проверяет лимиты импорта через production-конфигурацию nginx (нужны Docker и OpenSSL)."""

import http.client
import json
from pathlib import Path
import ssl
import subprocess
import tempfile
import time
import uuid


def run(*args):
    """Выполняет команду и возвращает stdout, завершая проверку при ошибке."""
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT).strip()


def request(port, path, size, chunked=False):
    """Отправляет тело заданного размера по HTTPS, при необходимости без Content-Length."""
    connection = http.client.HTTPSConnection(
        "127.0.0.1", port, context=ssl._create_unverified_context(), timeout=15
    )
    body = b"x" * size
    headers = {"Content-Type": "multipart/form-data; boundary=test"}
    if chunked:
        body = iter([body])
    connection.request("POST", path, body, headers, encode_chunked=chunked)
    response = connection.getresponse()
    result = response.status, response.getheader("Content-Type"), response.read()
    connection.close()
    return result


def main():
    """Запускает изолированный nginx и проверяет границы лимита и формат отказа."""
    name = "fm94-proxy-test-" + uuid.uuid4().hex[:8]
    with tempfile.TemporaryDirectory(prefix="fm94-proxy-") as folder:
        temporary = Path(folder)
        run("openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
            "-subj", "/CN=localhost", "-keyout", str(temporary / "privkey.pem"),
            "-out", str(temporary / "fullchain.pem"))
        config = (Path(__file__).resolve().parents[1] / "nginx/nginx.conf").read_text()
        # Подменяем только адреса upstream; маршруты и лимиты берём из реального конфига.
        config = config.replace("fm_auth_service:80", "127.0.0.1:8080")
        config = config.replace("fm_transaction_service:80", "127.0.0.1:8080")
        config = config.replace("http {", 'http {\n server { listen 8080; client_max_body_size 0; location / { return 201 "$request_uri"; } }', 1)
        (temporary / "nginx.conf").write_text(config)
        try:
            run("docker", "run", "-d", "--rm", "--name", name,
                "-p", "127.0.0.1::443", "-v", f"{temporary}/nginx.conf:/etc/nginx/nginx.conf:ro",
                "-v", f"{temporary}:/etc/nginx/ssl:ro", "nginx:1.29.2")
            port = int(run("docker", "port", name, "443/tcp").rsplit(":", 1)[1])
            for attempt in range(50):
                try:
                    request(port, "/", 0)
                    break
                except (OSError, http.client.HTTPException):
                    time.sleep(0.1)
            for kind in ("income", "outcome"):
                path = f"/transaction/import-export/imports/{kind}?format=csv"
                for chunked in (False, True):
                    for size in (2 * 1024**2, 6 * 1024**2):
                        status, _, body = request(port, path, size, chunked)
                        assert status == 201, (kind, size, chunked, status, body)
                        assert body.decode() == path, body
                    status, content_type, body = request(port, path, 6 * 1024**2 + 1, chunked)
                    assert status == 413, (status, body)
                    assert content_type == "application/problem+json", content_type
                    problem = json.loads(body)
                    assert problem["code"] == "FM-413301", problem
                    assert problem["status"] == 413, problem
                    assert {"type", "title", "detail", "instance"} <= problem.keys(), problem
                    assert problem["instance"] == path.split("?")[0], problem
            status, _, _ = request(port, "/transaction/transactions", 2 * 1024**2)
            assert status == 413, status
            print("PASS: import 2/6 MiB, >6 MiB problem+json, chunked, URI, other-route limit")
        finally:
            subprocess.run(["docker", "rm", "-f", name], capture_output=True, check=False)


if __name__ == "__main__":
    main()
