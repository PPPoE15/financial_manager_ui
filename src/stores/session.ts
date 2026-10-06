import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type { User } from '@/types/user'

export const TOKEN_STORAGE_KEY = 'authToken'

// Доступ к localStorage может бросить исключение (хранилище заблокировано настройками браузера) —
// тогда сессия живёт только в памяти до перезагрузки страницы.
function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredToken(value: string | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    } else {
      localStorage.setItem(TOKEN_STORAGE_KEY, value)
    }
  } catch {
    // Без хранилища токен остаётся только в состоянии
  }
}

/** Сессия пользователя: access-токен (переживает перезагрузку страницы) и текущий пользователь. */
export const useSessionStore = defineStore('session', () => {
  const token = ref<string | null>(readStoredToken())
  const user = ref<User | null>(null)

  const isAuthenticated = computed(() => token.value !== null)

  function setToken(value: string): void {
    token.value = value
    writeStoredToken(value)
  }

  function setUser(value: User): void {
    user.value = value
  }

  function clear(): void {
    token.value = null
    user.value = null
    writeStoredToken(null)
  }

  return { token, user, isAuthenticated, setToken, setUser, clear }
})
