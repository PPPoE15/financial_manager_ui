import { useRouter } from 'vue-router'

import { login } from '@/api/auth'
import { HOME_ROUTE } from '@/router/names'
import { useSessionStore } from '@/stores/session'
import type { LoginRequest } from '@/types/auth'

/** Вход: получает токен, сохраняет его в сессии и ведёт на главную. Ошибку запроса пробрасывает. */
export function useSignIn(): (credentials: LoginRequest) => Promise<void> {
  const session = useSessionStore()
  const router = useRouter()

  return async (credentials) => {
    const tokens = await login(credentials)
    session.setToken(tokens.access_token)
    await router.push({ name: HOME_ROUTE })
  }
}
