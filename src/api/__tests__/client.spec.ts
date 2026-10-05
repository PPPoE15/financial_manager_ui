import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { createPinia, setActivePinia } from 'pinia'

import { http } from '@/api/client'
import router, { LOGIN_ROUTE } from '@/router'
import { useSessionStore } from '@/stores/session'

describe('http (общий клиент приложения)', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('берёт токен из хранилища сессии', async () => {
    const sent: InternalAxiosRequestConfig[] = []
    useSessionStore().setToken('session-token')

    await http.get('/categories', {
      adapter: async (config) => {
        sent.push(config)
        return { data: {}, status: 200, statusText: '', headers: {}, config }
      },
    })

    expect(AxiosHeaders.from(sent[0]?.headers).get('Authorization')).toBe('Bearer session-token')
  })

  it('на 401 сбрасывает сессию и переходит на экран входа', async () => {
    const push = vi.spyOn(router, 'push').mockResolvedValue(undefined)
    const session = useSessionStore()
    session.setToken('expired')
    session.setUser({ uid: 'u', name: 'Артём', email: 'a@example.com' })

    await expect(
      http.get('/categories', {
        adapter: async (config) => {
          const response = { data: {}, status: 401, statusText: '', headers: {}, config }
          throw new AxiosError('Unauthorized', '401', config, null, response)
        },
      }),
    ).rejects.toBeInstanceOf(AxiosError)

    expect(session.token).toBeNull()
    expect(session.user).toBeNull()
    expect(push).toHaveBeenCalledWith({ name: LOGIN_ROUTE })
  })
})
