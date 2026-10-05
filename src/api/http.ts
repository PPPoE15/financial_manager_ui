import axios, { AxiosError, AxiosHeaders, type AxiosInstance } from 'axios'

export const TRANSACTION_API_URL = import.meta.env.VITE_API_URL || '/transaction'
export const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || '/auth'

/** Бэкенд, в который уходит запрос; по умолчанию — сервис транзакций. */
export type ApiName = 'transaction' | 'auth'

declare module 'axios' {
  interface AxiosRequestConfig {
    api?: ApiName
  }
}

const BASE_URLS: Record<ApiName, string> = {
  transaction: TRANSACTION_API_URL,
  auth: AUTH_API_URL,
}

export interface HttpClientOptions {
  /** Текущий access-токен или `null`, если пользователь не вошёл. */
  getToken: () => string | null
  /** Вызывается, когда бэкенд отклонил токен (401 на запрос с токеном). */
  onUnauthorized: () => void
}

/**
 * Создаёт axios-инстанс для обоих бэкендов: base URL выбирается по `config.api`,
 * токен подставляется в заголовок, 401 на авторизованный запрос обрабатывается централизованно.
 */
export function createHttpClient({ getToken, onUnauthorized }: HttpClientOptions): AxiosInstance {
  const http = axios.create()

  http.interceptors.request.use((config) => {
    config.baseURL = BASE_URLS[config.api ?? 'transaction']
    const token = getToken()
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`)
    }
    return config
  })

  http.interceptors.response.use(undefined, (error: unknown) => {
    // 401 без токена — это ответ на вход с неверными данными, его обрабатывает сам экран
    if (
      error instanceof AxiosError &&
      error.response?.status === 401 &&
      AxiosHeaders.from(error.config?.headers).has('Authorization')
    ) {
      onUnauthorized()
    }
    return Promise.reject(error)
  })

  return http
}
