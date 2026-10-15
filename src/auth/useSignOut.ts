import { useRouter } from 'vue-router'

import { logout } from '@/api/auth'
import { LOGIN_ROUTE } from '@/router/names'
import { useSessionStore } from '@/stores/session'

/** Выход: очищает сессию и ведёт на экран входа. */
export function useSignOut(): () => Promise<void> {
  const session = useSessionStore()
  const router = useRouter()

  return async () => {
    try {
      await logout()
    } catch {
      // При недоступном сервере локальный выход всё равно должен завершиться.
    } finally {
      session.clear()
    }
    await router.push({ name: LOGIN_ROUTE })
  }
}
