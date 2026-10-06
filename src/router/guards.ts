import type { NavigationGuard } from 'vue-router'

import { HOME_ROUTE } from '@/router/names'
import { useSessionStore } from '@/stores/session'

declare module 'vue-router' {
  interface RouteMeta {
    /** Экран только для гостей: авторизованного пользователя уводит на главную. */
    guestOnly?: boolean
  }
}

// NOTE(FM-13): «авторизован» = токен есть в хранилище, срок действия не проверяется. С истёкшим токеном
// guard уводит с /login на главную, а там пока нет запросов к API, которые сбросили бы сессию по 401.
// Закрывается в FM-13 (защищённая оболочка: /auth/me на главной, редирект при истёкшем токене, «Выйти»).
/** Экраны только для гостей (вход, регистрация): авторизованного пользователя уводит на главную. */
export const guestOnlyGuard: NavigationGuard = (to) =>
  to.meta.guestOnly && useSessionStore().isAuthenticated ? { name: HOME_ROUTE } : true

/**
 * Глобальные guard-ы приложения, выполняются по порядку перед каждым переходом.
 * Сюда подключаются проверки доступа (например, редирект неавторизованного пользователя на вход).
 */
export const guards: NavigationGuard[] = [guestOnlyGuard]
