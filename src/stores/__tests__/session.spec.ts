import { beforeEach, describe, expect, it } from 'vitest'
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
})
