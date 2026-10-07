import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'

import { login } from '@/api/auth'
import { HOME_ROUTE } from '@/router/names'
import { useSessionStore } from '@/stores/session'
import type { LoginRequest } from '@/types/auth'

/**
 * Куда вести после входа: путь из `redirect` (его ставит guard защищённых экранов) или главная.
 * Принимается только путь внутри приложения — внешние адреса (`https://…`, `//…`, `/\…`) отбрасываются.
 */
function afterSignIn(redirect: unknown): RouteLocationRaw {
  if (typeof redirect === 'string' && /^\/(?![/\\])/.test(redirect)) return redirect
  return { name: HOME_ROUTE }
}

/** Вход: получает токен, сохраняет его в сессии и ведёт на исходный экран. Ошибку запроса пробрасывает. */
export function useSignIn(): (credentials: LoginRequest) => Promise<void> {
  const session = useSessionStore()
  const router = useRouter()
  const route = useRoute()

  return async (credentials) => {
    const tokens = await login(credentials)
    session.setToken(tokens.access_token)
    await router.push(afterSignIn(route.query.redirect))
  }
}
