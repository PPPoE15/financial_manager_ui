import type { NavigationGuard, RouteLocationNormalized } from 'vue-router'

import { getCurrentUser } from '@/api/auth'
import { HOME_ROUTE, LOGIN_ROUTE } from '@/router/names'
import { useSessionStore } from '@/stores/session'

declare module 'vue-router' {
  interface RouteMeta {
    /** Экран только для гостей: авторизованного пользователя уводит на главную. */
    guestOnly?: boolean
  }
}

/** Экраны только для гостей (вход, регистрация): авторизованного пользователя уводит на главную. */
export const guestOnlyGuard: NavigationGuard = (to) =>
  to.meta.guestOnly && useSessionStore().isAuthenticated ? { name: HOME_ROUTE } : true

function toLogin(to: RouteLocationNormalized) {
  return { name: LOGIN_ROUTE, query: { redirect: to.fullPath } }
}

/**
 * Все экраны, кроме гостевых, — только после входа: без токена ведёт на экран входа и запоминает адрес
 * в `redirect`. При первом переходе с токеном загружает текущего пользователя (`GET /auth/me`); истёкший
 * токен даёт 401, HTTP-клиент сбрасывает сессию — и переход тоже уходит на экран входа.
 */
export const authGuard: NavigationGuard = async (to) => {
  if (to.meta.guestOnly) return true

  const session = useSessionStore()
  if (!session.isAuthenticated) return toLogin(to)
  if (session.user !== null) return true

  try {
    session.setUser(await getCurrentUser())
  } catch {
    if (!session.isAuthenticated) return toLogin(to)
    // NOTE(FM-13): прочие ошибки (сеть, 5xx) не закрывают доступ — экран открывается без имени,
    // пользователь загрузится при следующем переходе.
  }
  return true
}

/** Глобальные guard-ы приложения, выполняются по порядку перед каждым переходом. */
export const guards: NavigationGuard[] = [guestOnlyGuard, authGuard]
