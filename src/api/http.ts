import axios, { AxiosError, type AxiosInstance } from 'axios'
import type { TokenResponse } from '@/types/auth'

export const TRANSACTION_API_URL = import.meta.env.VITE_API_URL || '/transaction'
export const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || '/auth'
export type ApiName = 'transaction' | 'auth'

declare module 'axios' {
  interface AxiosRequestConfig {
    api?: ApiName
    /** Вход, регистрация и refresh не используют access и не обрабатывают 401 глобально. */
    skipAuth?: boolean
    /** Logout должен отправлять актуальный refresh, в том числе после повтора. */
    refreshTokenBody?: boolean
    /** Внутренние данные для единственного повтора и защиты от ответа старой сессии. */
    sessionGeneration?: number
    sessionToken?: string | null
    sessionRefreshToken?: string | null
    sessionRetried?: boolean
  }
}

const BASE_URLS: Record<ApiName, string> = {
  transaction: TRANSACTION_API_URL,
  auth: AUTH_API_URL,
}

export interface HttpClientOptions {
  getToken: () => string | null
  onUnauthorized: () => void
  getRefreshToken?: () => string | null
  getGeneration?: () => number
  isSigningOut?: () => boolean
  onRefreshed?: (pair: TokenResponse) => void
}

export interface SessionHttpClient extends AxiosInstance {
  waitForRefresh: () => Promise<void>
}

/** Общий клиент двух API; параллельные 401 одной сессии ожидают один refresh. */
export function createHttpClient({
  getToken,
  onUnauthorized,
  getRefreshToken = () => null,
  getGeneration = () => 0,
  isSigningOut = () => false,
  onRefreshed = () => {},
}: HttpClientOptions): SessionHttpClient {
  const http = axios.create() as SessionHttpClient
  let pending: { generation: number; promise: Promise<void> } | undefined
  http.waitForRefresh = async () => {
    await pending?.promise
  }

  http.interceptors.request.use((config) => {
    config.baseURL = BASE_URLS[config.api ?? 'transaction']
    const token = config.skipAuth ? null : getToken()
    config.sessionGeneration ??= getGeneration()
    config.sessionToken = token
    config.sessionRefreshToken = getRefreshToken()
    config.headers.delete('Authorization')
    if (token) config.headers.set('Authorization', `Bearer ${token}`)
    if (config.refreshTokenBody) config.data = { refresh_token: getRefreshToken() }
    return config
  })

  http.interceptors.response.use(undefined, async (error: unknown) => {
    if (!(error instanceof AxiosError) || error.response?.status !== 401) throw error
    const config = error.config
    if (!config || config.skipAuth || !config.sessionToken) throw error
    // Во время выхода только сам logout может обновлять пару. Уже начатую ротацию
    // logout дождётся перед отзывом, остальные 401 не должны создавать новый refresh.
    if (isSigningOut() && !config.refreshTokenBody) throw error
    const generation = config.sessionGeneration
    if (generation !== getGeneration() || !getToken()) throw error
    if (config.sessionRetried || !getRefreshToken()) {
      onUnauthorized()
      throw error
    }
    config.sessionRetried = true

    // Запоздалый 401 от прежнего access использует уже полученную пару без новой ротации.
    if (config.sessionToken === getToken() && config.sessionRefreshToken === getRefreshToken()) {
      if (!pending || pending.generation !== generation) {
        const refreshToken = getRefreshToken()
        const promise = (async () => {
          try {
            const { data } = await http.post<TokenResponse>(
              '/token/refresh',
              { refresh_token: refreshToken },
              { api: 'auth', skipAuth: true },
            )
            if (generation !== getGeneration()) throw error
            onRefreshed(data)
          } catch (refreshError) {
            if (generation === getGeneration()) onUnauthorized()
            throw refreshError
          }
        })()
        const entry = { generation: getGeneration(), promise }
        pending = entry
        // finally включён в ожидаемый промис: нет отдельного необработанного rejection.
        entry.promise = promise.finally(() => {
          if (pending === entry) pending = undefined
        })
      }
      await pending.promise
    }
    if (generation !== getGeneration() || !getToken()) throw error
    if (isSigningOut() && !config.refreshTokenBody) throw error
    return http.request(config)
  })

  return http
}
