import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type { TokenResponse } from '@/types/auth'
import type { User } from '@/types/user'

export const TOKEN_STORAGE_KEY = 'authToken'
export const REFRESH_STORAGE_KEY = 'refreshToken'

// Доступ к localStorage может бросить исключение (хранилище заблокировано настройками браузера) —
// тогда сессия живёт только в памяти до перезагрузки страницы.
function readStoredToken(key = TOKEN_STORAGE_KEY): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStoredToken(value: string | null, key = TOKEN_STORAGE_KEY): void {
  try {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  } catch {
    // Без хранилища токен остаётся только в состоянии
  }
}

/** Сессия пользователя: access-токен (переживает перезагрузку страницы) и текущий пользователь. */
export const useSessionStore = defineStore('session', () => {
  const token = ref<string | null>(readStoredToken())
  const refreshToken = ref<string | null>(readStoredToken(REFRESH_STORAGE_KEY))
  // Меняется при входе/выходе, но не при ротации токенов той же сессии.
  const generation = ref(0)
  const signingOut = ref(false)
  const user = ref<User | null>(null)

  const isAuthenticated = computed(() => token.value !== null)

  function setToken(value: string): void {
    generation.value++
    signingOut.value = false
    refreshToken.value = null
    writeStoredToken(null, REFRESH_STORAGE_KEY)
    token.value = value
    writeStoredToken(value)
  }

  function rotateTokens(pair: TokenResponse): void {
    token.value = pair.access_token
    refreshToken.value = pair.refresh_token
    writeStoredToken(pair.access_token)
    writeStoredToken(pair.refresh_token, REFRESH_STORAGE_KEY)
  }

  function setTokens(pair: TokenResponse): void {
    generation.value++
    signingOut.value = false
    user.value = null
    rotateTokens(pair)
  }

  function setUser(value: User): void {
    user.value = value
  }

  function clear(): void {
    generation.value++
    signingOut.value = false
    token.value = null
    refreshToken.value = null
    writeStoredToken(null, REFRESH_STORAGE_KEY)
    user.value = null
    writeStoredToken(null)
  }

  return {
    token,
    refreshToken,
    generation,
    signingOut,
    user,
    isAuthenticated,
    setToken,
    setTokens,
    rotateTokens,
    setUser,
    clear,
  }
})
