import { createHttpClient } from '@/api/http'
import router, { LOGIN_ROUTE } from '@/router'
import { useSessionStore } from '@/stores/session'

/** Общий HTTP-клиент приложения: токен из хранилища сессии, при 401 — сброс сессии и экран входа. */
export const http = createHttpClient({
  getToken: () => useSessionStore().token,
  onUnauthorized: () => {
    useSessionStore().clear()
    if (router.currentRoute.value.name !== LOGIN_ROUTE) {
      void router.push({ name: LOGIN_ROUTE })
    }
  },
})
