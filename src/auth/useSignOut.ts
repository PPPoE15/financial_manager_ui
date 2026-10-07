import { useRouter } from 'vue-router'

import { LOGIN_ROUTE } from '@/router/names'
import { useSessionStore } from '@/stores/session'

/** Выход: очищает сессию и ведёт на экран входа. */
export function useSignOut(): () => Promise<void> {
  const session = useSessionStore()
  const router = useRouter()

  return async () => {
    // TODO(FM-17): перед очисткой отзывать refresh-токен на сервере (`POST /auth/logout`).
    session.clear()
    await router.push({ name: LOGIN_ROUTE })
  }
}
