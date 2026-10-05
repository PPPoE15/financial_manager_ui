import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type { User } from '@/types/user'

export const TOKEN_STORAGE_KEY = 'authToken'

/** Сессия пользователя: access-токен (переживает перезагрузку страницы) и текущий пользователь. */
export const useSessionStore = defineStore('session', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_STORAGE_KEY))
  const user = ref<User | null>(null)

  const isAuthenticated = computed(() => token.value !== null)

  function setToken(value: string): void {
    token.value = value
    localStorage.setItem(TOKEN_STORAGE_KEY, value)
  }

  function setUser(value: User): void {
    user.value = value
  }

  function clear(): void {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  }

  return { token, user, isAuthenticated, setToken, setUser, clear }
})
