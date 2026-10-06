import type { NavigationGuard } from 'vue-router'

import { HOME_ROUTE } from '@/router/names'
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

/**
 * Глобальные guard-ы приложения, выполняются по порядку перед каждым переходом.
 * Сюда подключаются проверки доступа (например, редирект неавторизованного пользователя на вход).
 */
export const guards: NavigationGuard[] = [guestOnlyGuard]
