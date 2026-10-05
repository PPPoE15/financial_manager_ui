import type { NavigationGuard } from 'vue-router'

/**
 * Глобальные guard-ы приложения, выполняются по порядку перед каждым переходом.
 * Сюда подключаются проверки доступа (например, редирект неавторизованного пользователя на вход).
 */
export const guards: NavigationGuard[] = []
