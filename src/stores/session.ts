import { computed, onScopeDispose, ref } from 'vue'
import { defineStore } from 'pinia'
import type { TokenResponse } from '@/types/auth'
import type { User } from '@/types/user'

export const TOKEN_STORAGE_KEY = 'authToken'
export const REFRESH_STORAGE_KEY = 'refreshToken'
export const SESSION_STORAGE_KEY = 'authSession'

interface StoredSession {
  id: string
  token: string | null
  refreshToken: string | null
}
function decode(raw: string | null): StoredSession | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<StoredSession> | null
    if (
      value &&
      typeof value.id === 'string' &&
      (typeof value.token === 'string' || value.token === null) &&
      (typeof value.refreshToken === 'string' || value.refreshToken === null)
    )
      return value as StoredSession
  } catch {
    /* Повреждённая запись означает отсутствие сессии. */
  }
  return null
}

/** Пара сохраняется одной записью; id отличает новый вход от ротации той же сессии. */
export const useSessionStore = defineStore('session', () => {
  let storageAvailable = true
  let lastStored: string | null = null
  let initial: StoredSession | null = null
  try {
    lastStored = localStorage.getItem(SESSION_STORAGE_KEY)
    initial = decode(lastStored)
    if (!lastStored) {
      initial = {
        id: 'legacy',
        token: localStorage.getItem(TOKEN_STORAGE_KEY),
        refreshToken: localStorage.getItem(REFRESH_STORAGE_KEY),
      }
    }
  } catch {
    storageAvailable = false
  }
  const token = ref(initial?.token ?? null)
  const refreshToken = ref(initial?.refreshToken ?? null)
  const generation = ref(initial?.id ?? crypto.randomUUID())
  const signingOut = ref(false)
  const user = ref<User | null>(null)
  const externalChange = ref(0)
  const isAuthenticated = computed(() => token.value !== null)

  function persist(): void {
    if (!storageAvailable) return
    const raw = JSON.stringify({
      id: generation.value,
      token: token.value,
      refreshToken: refreshToken.value,
    })
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, raw)
      lastStored = raw
    } catch {
      storageAvailable = false
      return
    }
    // Совместимость со старой access-only сессией. Источник истины — только authSession.
    try {
      if (token.value === null) localStorage.removeItem(TOKEN_STORAGE_KEY)
      else localStorage.setItem(TOKEN_STORAGE_KEY, token.value)
      localStorage.removeItem(REFRESH_STORAGE_KEY)
    } catch {
      /* Пара уже записана атомарно; старые ключи не используются при чтении. */
    }
  }

  /** Читается также под блокировкой: событие storage может ещё стоять в очереди. */
  function sync(): void {
    if (!storageAvailable) return
    let raw: string | null
    try {
      raw = localStorage.getItem(SESSION_STORAGE_KEY)
    } catch {
      return
    }
    if (raw === lastStored) return
    lastStored = raw
    const next = decode(raw)
    const id = next?.id ?? crypto.randomUUID()
    if (id !== generation.value) {
      generation.value = id
      user.value = null
      signingOut.value = false
      externalChange.value++
    }
    token.value = next?.token ?? null
    refreshToken.value = next?.refreshToken ?? null
  }
  function onStorage(event: StorageEvent): void {
    if (event.key === SESSION_STORAGE_KEY || event.key === null) sync()
  }
  window.addEventListener('storage', onStorage)
  onScopeDispose(() => window.removeEventListener('storage', onStorage))

  function setToken(value: string): void {
    generation.value = crypto.randomUUID()
    signingOut.value = false
    token.value = value
    refreshToken.value = null
    user.value = null
    persist()
  }
  function rotateTokens(pair: TokenResponse): void {
    token.value = pair.access_token
    refreshToken.value = pair.refresh_token
    persist()
  }
  function setTokens(pair: TokenResponse): void {
    generation.value = crypto.randomUUID()
    signingOut.value = false
    user.value = null
    rotateTokens(pair)
  }
  function setUser(value: User): void {
    user.value = value
  }
  function clear(): void {
    generation.value = crypto.randomUUID()
    signingOut.value = false
    token.value = null
    refreshToken.value = null
    user.value = null
    // Пустая запись с новым id не даёт позднему ответу восстановить завершённую сессию.
    persist()
  }
  return {
    token,
    refreshToken,
    generation,
    signingOut,
    user,
    externalChange,
    isAuthenticated,
    setToken,
    setTokens,
    rotateTokens,
    setUser,
    clear,
    sync,
  }
})
