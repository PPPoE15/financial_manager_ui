import { describe, expect, it, vi } from 'vitest'
import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'

import { AUTH_API_URL, TRANSACTION_API_URL, createHttpClient } from '@/api/http'

/** Адаптер-заглушка: запоминает отправленный запрос и отвечает заданным статусом. */
function stubAdapter(status = 200) {
  const sent: InternalAxiosRequestConfig[] = []
  const adapter: AxiosAdapter = async (config) => {
    sent.push(config)
    const response = { data: {}, status, statusText: '', headers: {}, config }
    if (status >= 400) {
      throw new AxiosError('Ошибка', String(status), config, null, response)
    }
    return response
  }
  return { adapter, sent }
}

function setup(options: { token?: string | null; status?: number } = {}) {
  const { adapter, sent } = stubAdapter(options.status)
  const onUnauthorized = vi.fn()
  const http = createHttpClient({ getToken: () => options.token ?? null, onUnauthorized })
  http.defaults.adapter = adapter
  return { http, sent, onUnauthorized }
}

function authorizationOf(config: InternalAxiosRequestConfig | undefined) {
  return AxiosHeaders.from(config?.headers).get('Authorization')
}

describe('createHttpClient', () => {
  it('по умолчанию отправляет запросы в API транзакций', async () => {
    const { http, sent } = setup()

    await http.get('/categories')

    expect(sent[0]?.baseURL).toBe(TRANSACTION_API_URL)
  })

  it('с api: "auth" отправляет запросы в API авторизации', async () => {
    const { http, sent } = setup()

    await http.post('/token', {}, { api: 'auth' })

    expect(sent[0]?.baseURL).toBe(AUTH_API_URL)
  })

  it('подставляет Bearer-токен, если он есть', async () => {
    const { http, sent } = setup({ token: 'secret' })

    await http.get('/categories')

    expect(authorizationOf(sent[0])).toBe('Bearer secret')
  })

  it('без токена не добавляет заголовок Authorization', async () => {
    const { http, sent } = setup({ token: null })

    await http.get('/categories')

    expect(authorizationOf(sent[0])).toBeUndefined()
  })

  it('на 401 для запроса с токеном вызывает onUnauthorized и пробрасывает ошибку', async () => {
    const { http, onUnauthorized } = setup({ token: 'expired', status: 401 })

    await expect(http.get('/categories')).rejects.toMatchObject({ response: { status: 401 } })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('на 401 для запроса без токена (неверный пароль) не вызывает onUnauthorized', async () => {
    const { http, onUnauthorized } = setup({ token: null, status: 401 })

    await expect(http.post('/token', {}, { api: 'auth' })).rejects.toMatchObject({
      response: { status: 401 },
    })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('со skipAuth не подставляет сохранённый токен', async () => {
    const { http, sent } = setup({ token: 'stale' })

    await http.post('/token', {}, { api: 'auth', skipAuth: true })

    expect(authorizationOf(sent[0])).toBeUndefined()
  })

  it('со skipAuth на 401 (неверный пароль при старом токене) не вызывает onUnauthorized', async () => {
    const { http, onUnauthorized } = setup({ token: 'stale', status: 401 })

    await expect(http.post('/token', {}, { api: 'auth', skipAuth: true })).rejects.toMatchObject({
      response: { status: 401 },
    })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('другие ошибки пробрасывает без вызова onUnauthorized', async () => {
    const { http, onUnauthorized } = setup({ token: 'secret', status: 500 })

    await expect(http.get('/categories')).rejects.toMatchObject({ response: { status: 500 } })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})
