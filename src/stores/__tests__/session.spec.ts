import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { TOKEN_STORAGE_KEY, useSessionStore } from '@/stores/session'

const user = { uid: '3fa85f64-5717-4562-b3fc-2c963f66afa6', name: 'Артём', email: 'a@example.com' }

describe('useSessionStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('без сохранённого токена сессия пустая', () => {
    const session = useSessionStore()

    expect(session.token).toBeNull()
    expect(session.user).toBeNull()
    expect(session.isAuthenticated).toBe(false)
  })

  it('восстанавливает токен из localStorage', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'saved-token')

    const session = useSessionStore()

    expect(session.token).toBe('saved-token')
    expect(session.isAuthenticated).toBe(true)
  })

  it('setToken сохраняет токен в состоянии и localStorage', () => {
    const session = useSessionStore()

    session.setToken('new-token')

    expect(session.token).toBe('new-token')
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('new-token')
  })

  it('setUser сохраняет текущего пользователя', () => {
    const session = useSessionStore()

    session.setUser(user)

    expect(session.user).toEqual(user)
  })

  it('clear сбрасывает токен, пользователя и localStorage', () => {
    const session = useSessionStore()
    session.setToken('token')
    session.setUser(user)

    session.clear()

    expect(session.token).toBeNull()
    expect(session.user).toBeNull()
    expect(session.isAuthenticated).toBe(false)
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
  })

  it('при недоступном localStorage работает с сессией в памяти', () => {
    const denied = () => {
      throw new DOMException('Доступ запрещён', 'SecurityError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(denied)

    const session = useSessionStore()
    expect(session.token).toBeNull()

    session.setToken('token')
    expect(session.token).toBe('token')

    session.clear()
    expect(session.token).toBeNull()
  })
})

describe('пара токенов', () => {
  it('сохраняет, восстанавливает и очищает оба токена', () => {
    localStorage.clear()
    setActivePinia(createPinia())
    const session = useSessionStore()
    session.setTokens({
      access_token: 'access',
      refresh_token: 'refresh',
      token_type: 'bearer',
      expires_in: 900,
    })
    setActivePinia(createPinia())
    const restored = useSessionStore()
    expect(restored.token).toBe('access')
    expect(restored.refreshToken).toBe('refresh')
    restored.clear()
    setActivePinia(createPinia())
    expect(useSessionStore().token).toBeNull()
    expect(useSessionStore().refreshToken).toBeNull()
  })
})

it('на обычном HTTP без randomUUID сохраняет вход и полностью очищает сессию', () => {
  const getRandomValues = crypto.getRandomValues.bind(crypto)
  vi.stubGlobal('crypto', { getRandomValues })
  try {
    localStorage.clear()
    setActivePinia(createPinia())
    const session = useSessionStore()
    session.setTokens({
      access_token: 'A',
      refresh_token: 'R',
      token_type: 'bearer',
      expires_in: 900,
    })
    const loginId = session.generation
    expect(session.token).toBe('A')
    session.clear()
    expect(session.generation).not.toBe(loginId)
    expect(session.token).toBeNull()
    expect(session.refreshToken).toBeNull()
    setActivePinia(createPinia())
    expect(useSessionStore().token).toBeNull()
    expect(useSessionStore().refreshToken).toBeNull()
  } finally {
    vi.unstubAllGlobals()
  }
})
