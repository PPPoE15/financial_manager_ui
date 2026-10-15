import { createHttpClient } from '@/api/http'
import { withSessionLock } from '@/auth/sessionLock'
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
export function createSessionHttpClient(
  session: () => ReturnType<typeof useSessionStore> = useSessionStore,
  expired: () => void = () => onSessionExpired(),
) {
  return createHttpClient({
    getToken: () => session().token,
    getRefreshToken: () => session().refreshToken,
    isSigningOut: () => session().signingOut,
    getGeneration: () => session().generation,
    syncSession: () => session().sync(),
    withSessionLock,
    onRefreshed: (pair) => session().rotateTokens(pair),
    onUnauthorized: () => {
      session().clear()
      expired()
    },
  })
}
export const http = createSessionHttpClient()
