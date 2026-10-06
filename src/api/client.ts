import { createHttpClient } from '@/api/http'
import { useSessionStore } from '@/stores/session'

let onSessionExpired: () => void = () => {}

/**
 * Задаёт действие после сброса истёкшей сессии (переход на экран входа).
 * Подключается из `main.ts`, чтобы API-слой не импортировал роутер: иначе guard,
 * обращающийся к API, замкнёт цикл импортов client → router → guards → client.
 */
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler
}

/** Общий HTTP-клиент приложения: токен из хранилища сессии, при 401 — сброс сессии и экран входа. */
export const http = createHttpClient({
  getToken: () => useSessionStore().token,
  onUnauthorized: () => {
    useSessionStore().clear()
    onSessionExpired()
  },
})
