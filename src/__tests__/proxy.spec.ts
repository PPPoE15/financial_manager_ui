// @vitest-environment node
// Конфиг Vite тянет esbuild, который не работает в jsdom
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { describe, expect, it } from 'vitest'
import type { ProxyOptions } from 'vite'

import viteConfig from '../../vite.config'

// Сервис авторизации сам монтирует API под /auth, сервис транзакций — без префикса,
// поэтому префикс снимается только для /transaction/ (в прокси Vite и в nginx одинаково).

function devProxy(prefix: string): ProxyOptions {
  const proxy = viteConfig.server?.proxy?.[prefix]
  if (proxy === undefined || typeof proxy === 'string') {
    throw new Error(`Нет прокси ${prefix} в vite.config.ts`)
  }
  return proxy
}

function forwardedPath(proxy: ProxyOptions, path: string): string {
  return proxy.rewrite ? proxy.rewrite(path) : path
}

describe('прокси Vite в dev-режиме', () => {
  it('отправляет /auth/ в сервис авторизации, сохраняя префикс', () => {
    const proxy = devProxy('/auth/')

    expect(proxy.target).toBe('http://localhost:8082')
    expect(forwardedPath(proxy, '/auth/token')).toBe('/auth/token')
  })

  it('отправляет /transaction/ в сервис транзакций без префикса', () => {
    const proxy = devProxy('/transaction/')

    expect(proxy.target).toBe('http://localhost:8083')
    expect(forwardedPath(proxy, '/transaction/categories')).toBe('/categories')
  })
})

describe('nginx.conf', () => {
  const nginxConf = readFileSync(
    fileURLToPath(new URL('../../nginx/nginx.conf', import.meta.url)),
    'utf8',
  )

  function proxyPass(location: string): string | undefined {
    const block = nginxConf.match(new RegExp(`location ${location} \\{([^}]*)\\}`))?.[1]
    return block?.match(/proxy_pass\s+([^;]+);/)?.[1]
  }

  it('проксирует /auth/ без URI в proxy_pass — префикс сохраняется', () => {
    expect(proxyPass('/auth/')).toBe('http://fm_auth_service:80')
  })

  it('проксирует /transaction/ с URI / в proxy_pass — префикс снимается', () => {
    expect(proxyPass('/transaction/')).toBe('http://fm_transaction_service:80/')
  })
})
