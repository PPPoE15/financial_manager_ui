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

/** Общий HTTP-клиент приложения: токен из хранилища сессии, при неудачном продлении — сброс сессии и экран входа. */
export const http = createHttpClient({
  getToken: () => useSessionStore().token,
  getRefreshToken: () => useSessionStore().refreshToken,
  isSigningOut: () => useSessionStore().signingOut,
  getGeneration: () => useSessionStore().generation,
  onRefreshed: (pair) => useSessionStore().rotateTokens(pair),
  onUnauthorized: () => {
    useSessionStore().clear()
    onSessionExpired()
  },
})
