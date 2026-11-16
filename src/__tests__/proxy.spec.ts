// @vitest-environment node
// Конфиг Vite тянет esbuild, который не работает в jsdom
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { describe, expect, it } from 'vitest'
import type { ProxyOptions } from 'vite'

// TODO(FM-31): импортируется весь конфиг с плагинами (vue, devtools) ради server.proxy — отсюда окружение node и
// медленный импорт; вынести таблицу прокси в отдельный модуль и импортировать его здесь и в vite.config.ts
import viteConfig from '../../vite.config'

// Оба сервиса сами монтируют API под своим префиксом (/auth, /transaction), поэтому прокси Vite
// и nginx передают путь как есть.

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

  it('отправляет /transaction/ в сервис транзакций, сохраняя префикс', () => {
    const proxy = devProxy('/transaction/')

    expect(proxy.target).toBe('http://localhost:8083')
    expect(forwardedPath(proxy, '/transaction/categories')).toBe('/transaction/categories')
  })
})

describe('nginx.conf', () => {
  const nginxConf = readFileSync(
    fileURLToPath(new URL('../../nginx/nginx.conf', import.meta.url)),
    'utf8',
  )

  // NOTE(FM-31): упрощённый разбор регуляркой — защищает от регрессии FM-31, но падает на безобидных правках
  // (модификатор ^~, вложенный блок, эквивалентный proxy_pass с URI /auth/) и не видит перекрывающих location
  function proxyPass(location: string): string | undefined {
    const block = nginxConf.match(new RegExp(`location ${location} \\{([^}]*)\\}`))?.[1]
    return block?.match(/proxy_pass\s+([^;]+);/)?.[1]
  }

  it('проксирует /auth/ без URI в proxy_pass — префикс сохраняется', () => {
    expect(proxyPass('/auth/')).toBe('http://fm_auth_service:80')
  })

  it('проксирует /transaction/ без URI в proxy_pass — префикс сохраняется', () => {
    expect(proxyPass('/transaction/')).toBe('http://fm_transaction_service:80')
  })
})
