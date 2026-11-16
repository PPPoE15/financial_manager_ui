import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { useSessionStore } from '@/stores/session'
import { createSessionHttpClient } from '@/api/client'
import { logoutSession } from '@/api/auth'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
function reply(config: InternalAxiosRequestConfig, status = 200, data: unknown = {}) {
  const response = { config, status, data, headers: {}, statusText: '' }
  if (status >= 400) throw new AxiosError('Ошибка', String(status), config, null, response)
  return response
}
const pair = (n: number) => ({
  access_token: `A${n}`,
  refresh_token: `R${n}`,
  token_type: 'bearer',
  expires_in: 900,
})
const stores: ReturnType<typeof useSessionStore>[] = []
function tab() {
  const session = useSessionStore(createPinia())
  stores.push(session)
  const expired = vi.fn()
  const http = createSessionHttpClient(() => session, expired)
  return { session, http, expired }
}
beforeEach(() => {
  localStorage.clear()
  let queue = Promise.resolve()
  vi.stubGlobal('navigator', {
    locks: {
      request: vi.fn((_name: string, action: () => Promise<void>) => {
        const next = queue.then(action)
        queue = next.catch(() => {})
        return next
      }),
    },
  })
})
afterEach(() => {
  stores.splice(0).forEach((s) => s.$dispose())
  vi.unstubAllGlobals()
})

describe('сессия в двух вкладках', () => {
  it('два одновременных 401 выполняют одну ротацию даже без события storage', async () => {
    const a = tab()
    a.session.setTokens(pair(1))
    const b = tab()
    const gate = deferred()
    const refreshed = vi.fn()
    const adapter: AxiosAdapter = async (config) => {
      if (config.url === '/token/refresh') {
        refreshed()
        await gate.promise
        return reply(config, 200, pair(2))
      }
      return reply(config, config.headers.get('Authorization') === 'Bearer A1' ? 401 : 200)
    }
    a.http.defaults.adapter = b.http.defaults.adapter = adapter
    const results = Promise.allSettled([a.http.get('/a'), b.http.get('/b')])
    await vi.waitFor(() => expect(refreshed).toHaveBeenCalledOnce())
    gate.resolve()
    expect((await results).map((r) => r.status)).toEqual(['fulfilled', 'fulfilled'])
    expect(refreshed).toHaveBeenCalledOnce()
    expect(a.session.refreshToken).toBe('R2')
    expect(b.session.refreshToken).toBe('R2')
    expect(b.expired).not.toHaveBeenCalled()
    expect(tab().session.refreshToken).toBe('R2')
  })

  it('запоздалый 401 использует ротацию другой вкладки', async () => {
    const a = tab()
    a.session.setTokens(pair(1))
    const b = tab()
    const sent = deferred()
    const late = deferred()
    let requests = 0
    b.http.defaults.adapter = async (config) => {
      requests++
      if (requests === 1) {
        sent.resolve()
        await late.promise
        return reply(config, 401)
      }
      expect(config.headers.get('Authorization')).toBe('Bearer A2')
      return reply(config)
    }
    const request = b.http.get('/late')
    await sent.promise
    a.session.rotateTokens(pair(2))
    late.resolve()
    await request
    expect(requests).toBe(2)
    expect(b.expired).not.toHaveBeenCalled()
  })

  it('событие storage применяет целую пару и выход без записи обратно', () => {
    const a = tab()
    a.session.setTokens(pair(1))
    const b = tab()
    a.session.rotateTokens(pair(2))
    const snapshot = localStorage.getItem('authSession')
    window.dispatchEvent(new StorageEvent('storage', { key: 'authSession', newValue: snapshot }))
    expect(b.session.refreshToken).toBe('R2')
    a.session.clear()
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'authSession',
        newValue: localStorage.getItem('authSession'),
      }),
    )
    expect(b.session.token).toBeNull()
    expect(b.session.user).toBeNull()
    expect(tab().session.token).toBeNull()
  })

  it('выход другой вкладки дожидается refresh и отзывает новую пару', async () => {
    const a = tab()
    a.session.setTokens(pair(1))
    const b = tab()
    const started = deferred()
    const gate = deferred()
    const revoked: string[] = []
    const adapter: AxiosAdapter = async (config) => {
      if (config.url === '/token/refresh') {
        started.resolve()
        await gate.promise
        return reply(config, 200, pair(2))
      }
      if (config.url === '/logout') {
        revoked.push(JSON.parse(config.data).refresh_token)
        return reply(config, 204)
      }
      return reply(config, config.headers.get('Authorization') === 'Bearer A1' ? 401 : 200)
    }
    a.http.defaults.adapter = b.http.defaults.adapter = adapter
    const request = Promise.allSettled([a.http.get('/a')])
    await started.promise
    const leaving = logoutSession(b.http, b.session)
    gate.resolve()
    await Promise.all([request, leaving])
    expect(revoked).toEqual(['R2'])
    a.session.sync()
    expect(a.session.token).toBeNull()
    expect(b.session.token).toBeNull()
  })

  it('401 другой вкладки во время logout не восстанавливает сессию', async () => {
    const a = tab()
    a.session.setTokens(pair(1))
    const b = tab()
    const started = deferred()
    const gate = deferred()
    const refreshed = vi.fn()
    const adapter: AxiosAdapter = async (config) => {
      if (config.url === '/logout') {
        started.resolve()
        await gate.promise
        return reply(config, 204)
      }
      if (config.url === '/token/refresh') {
        refreshed()
        return reply(config, 200, pair(2))
      }
      return reply(config, 401)
    }
    a.http.defaults.adapter = b.http.defaults.adapter = adapter
    const leaving = logoutSession(a.http, a.session)
    await started.promise
    const request = Promise.allSettled([b.http.get('/b')])
    gate.resolve()
    await Promise.all([leaving, request])
    expect(refreshed).not.toHaveBeenCalled()
    expect(tab().session.token).toBeNull()
  })

  it.each([200, 401])(
    'ответ refresh %s не заменяет новый вход в другой вкладке',
    async (status) => {
      const a = tab()
      a.session.setTokens(pair(1))
      const b = tab()
      const started = deferred()
      const gate = deferred()
      b.http.defaults.adapter = async (config) => {
        if (config.url === '/token/refresh') {
          started.resolve()
          await gate.promise
          return reply(config, status, pair(2))
        }
        return reply(config, 401)
      }
      const request = Promise.allSettled([b.http.get('/b')])
      await started.promise
      a.session.setTokens(pair(3))
      gate.resolve()
      await request
      expect(tab().session.token).toBe('A3')
      expect(b.expired).not.toHaveBeenCalled()
    },
  )
  it.each([200, 401])(
    'без Web Locks logout со статусом %s не расходует refresh',
    async (status) => {
      vi.stubGlobal('navigator', {})
      const a = tab()
      a.session.setTokens(pair(1))
      const sent: string[] = []
      a.http.defaults.adapter = async (config) => {
        sent.push(config.url!)
        return reply(config, status)
      }
      await Promise.allSettled([logoutSession(a.http, a.session)])
      expect(sent).toEqual(['/logout'])
      expect(a.session.token).toBeNull()
    },
  )

  it('без Web Locks автоматический refresh завершается выходом без запроса ротации', async () => {
    vi.stubGlobal('navigator', {})
    const a = tab()
    a.session.setTokens(pair(1))
    const sent: string[] = []
    a.http.defaults.adapter = async (config) => {
      sent.push(config.url!)
      return reply(config, 401)
    }
    await expect(a.http.get('/a')).rejects.toBeDefined()
    expect(sent).toEqual(['/a'])
    expect(a.session.token).toBeNull()
  })

  it('успешный ответ старого аккаунта не передаётся экрану после смены сессии', async () => {
    const a = tab()
    a.session.setTokens(pair(1))
    const b = tab()
    const sent = deferred()
    const gate = deferred()
    b.http.defaults.adapter = async (config) => {
      sent.resolve()
      await gate.promise
      return reply(config, 200, { name: 'Старый пользователь' })
    }
    const result = Promise.allSettled([b.http.get('/me', { api: 'auth' })])
    await sent.promise
    a.session.setTokens(pair(3))
    gate.resolve()
    expect((await result)[0]?.status).toBe('rejected')
    expect(b.session.token).toBe('A3')
  })
})
