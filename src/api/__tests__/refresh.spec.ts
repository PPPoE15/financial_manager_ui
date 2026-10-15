import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { http, setSessionExpiredHandler } from '@/api/client'
import { useSessionStore } from '@/stores/session'
import { logout } from '@/api/auth'

const pair = {
  access_token: 'new-access',
  refresh_token: 'new-refresh',
  token_type: 'bearer',
  expires_in: 900,
}
function reply(config: InternalAxiosRequestConfig, status = 200, data: unknown = {}) {
  const response = { config, status, data, headers: {}, statusText: '' }
  if (status >= 400) throw new AxiosError('Ошибка', String(status), config, null, response)
  return response
}
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
const originalAdapter = http.defaults.adapter
let expired = vi.fn()
beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  useSessionStore().setTokens({ ...pair, access_token: 'old-access', refresh_token: 'old-refresh' })
  expired = vi.fn()
  setSessionExpiredHandler(expired)
})
afterEach(() => {
  http.defaults.adapter = originalAdapter
})

describe('продление сессии', () => {
  it('обновляет пару и повторяет запрос с тем же телом, параметрами и API', async () => {
    const sent: InternalAxiosRequestConfig[] = []
    http.defaults.adapter = async (config) => {
      sent.push(config)
      if (config.url === '/token/refresh') return reply(config, 200, pair)
      return reply(
        config,
        config.headers.get('Authorization') === 'Bearer old-access' ? 401 : 200,
        { ok: true },
      )
    }
    const response = await http.patch('/me', { name: 'Анна' }, { api: 'auth', params: { test: 1 } })
    expect(response.data).toEqual({ ok: true })
    expect(sent.map((c) => c.url)).toEqual(['/me', '/token/refresh', '/me'])
    expect(sent[1]?.baseURL).toBe('/auth')
    expect(sent[1]?.headers.has('Authorization')).toBe(false)
    expect(JSON.parse(sent[1]!.data)).toEqual({ refresh_token: 'old-refresh' })
    expect(sent[2]).toMatchObject({
      method: 'patch',
      baseURL: '/auth',
      params: { test: 1 },
      data: JSON.stringify({ name: 'Анна' }),
    })
    expect(useSessionStore().token).toBe(pair.access_token)
    expect(useSessionStore().refreshToken).toBe(pair.refresh_token)
    expect(expired).not.toHaveBeenCalled()
  })

  it.each([false, true])(
    'параллельные и запоздалые 401 используют одно обновление (одинаковый access: %s)',
    async (sameAccess) => {
      const gate = deferred()
      const late = deferred()
      const seen = new Set<string>()
      const refresh = vi.fn()
      http.defaults.adapter = async (config) => {
        if (config.url === '/token/refresh') {
          refresh()
          await gate.promise
          return reply(config, 200, sameAccess ? { ...pair, access_token: 'old-access' } : pair)
        }
        if (!seen.has(config.url!)) {
          seen.add(config.url!)
          if (config.url === '/late') await late.promise
          return reply(config, 401)
        }
        return reply(config)
      }
      const requests = [http.get('/a'), http.get('/b'), http.get('/late')]
      await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce())
      gate.resolve()
      await Promise.all(requests.slice(0, 2))
      late.resolve()
      await Promise.all(requests)
      expect(refresh).toHaveBeenCalledOnce()
    },
  )

  it.each([401, 500, 'network'])('ошибка refresh %s очищает сессию один раз', async (status) => {
    const gate = deferred()
    const refresh = vi.fn()
    http.defaults.adapter = async (config) => {
      if (config.url === '/token/refresh') {
        refresh()
        await gate.promise
        if (status === 'network') throw new AxiosError('Network Error')
        return reply(config, Number(status))
      }
      return reply(config, 401)
    }
    const results = Promise.allSettled([http.get('/a'), http.get('/b')])
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce())
    gate.resolve()
    expect((await results).every((r) => r.status === 'rejected')).toBe(true)
    expect(useSessionStore().token).toBeNull()
    expect(useSessionStore().refreshToken).toBeNull()
    expect(expired).toHaveBeenCalledOnce()
  })

  it('повторный 401 не запускает второе обновление', async () => {
    const refresh = vi.fn()
    http.defaults.adapter = async (config) => {
      if (config.url === '/token/refresh') {
        refresh()
        return reply(config, 200, pair)
      }
      return reply(config, 401)
    }
    await expect(http.get('/a')).rejects.toMatchObject({ response: { status: 401 } })
    expect(refresh).toHaveBeenCalledOnce()
    expect(useSessionStore().token).toBeNull()
  })

  it.each([false, true])(
    'результат refresh не восстанавливает завершённую сессию (новый вход: %s)',
    async (signIn) => {
      const gate = deferred()
      const refresh = vi.fn()
      http.defaults.adapter = async (config) => {
        if (config.url === '/token/refresh') {
          refresh()
          await gate.promise
          return reply(config, 200, pair)
        }
        return reply(config, 401)
      }
      const result = Promise.allSettled([http.get('/a')])
      await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce())
      useSessionStore().clear()
      if (signIn) useSessionStore().setTokens({ ...pair, access_token: 'another-user' })
      gate.resolve()
      await result
      expect(useSessionStore().token).toBe(signIn ? 'another-user' : null)
      expect(expired).not.toHaveBeenCalled()
    },
  )

  it('logout после истечения access отзывает новый refresh из ротированной пары', async () => {
    const bodies: unknown[] = []
    http.defaults.adapter = async (config) => {
      if (config.url === '/token/refresh') return reply(config, 200, pair)
      bodies.push(JSON.parse(config.data))
      return reply(config, config.headers.get('Authorization') === 'Bearer old-access' ? 401 : 204)
    }
    await logout()
    expect(bodies).toEqual([{ refresh_token: 'old-refresh' }, { refresh_token: 'new-refresh' }])
  })
  it('выход не допускает ротацию от параллельного 401 после отправки logout', async () => {
    const logoutStarted = deferred()
    const finishLogout = deferred()
    const active = new Set(['old-refresh'])
    const refresh = vi.fn()
    http.defaults.adapter = async (config) => {
      if (config.url === '/token/refresh') {
        refresh()
        active.delete('old-refresh')
        active.add(pair.refresh_token)
        return reply(config, 200, pair)
      }
      if (config.url === '/logout') {
        logoutStarted.resolve()
        await finishLogout.promise
        active.delete(JSON.parse(config.data).refresh_token)
        return reply(config, 204)
      }
      await logoutStarted.promise
      return reply(config, config.headers.get('Authorization') === 'Bearer old-access' ? 401 : 200)
    }
    const request = Promise.allSettled([http.get('/parallel')])
    const signingOut = logout()
    await logoutStarted.promise
    await request
    finishLogout.resolve()
    await signingOut
    expect(refresh).not.toHaveBeenCalled()
    expect([...active]).toEqual([])
  })

  it('выход ждёт начатую ротацию и отзывает её результат', async () => {
    const refreshStarted = deferred()
    const finishRefresh = deferred()
    const revoked: string[] = []
    http.defaults.adapter = async (config) => {
      if (config.url === '/token/refresh') {
        refreshStarted.resolve()
        await finishRefresh.promise
        return reply(config, 200, pair)
      }
      if (config.url === '/logout') {
        revoked.push(JSON.parse(config.data).refresh_token)
        return reply(config, 204)
      }
      return reply(config, config.headers.get('Authorization') === 'Bearer old-access' ? 401 : 200)
    }
    const request = Promise.allSettled([http.get('/parallel')])
    await refreshStarted.promise
    const signingOut = logout()
    expect(revoked).toEqual([])
    finishRefresh.resolve()
    await Promise.all([request, signingOut])
    expect(revoked).toEqual(['new-refresh'])
  })
})
