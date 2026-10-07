import { http } from '@/api/client'
import type { LoginRequest, RegistrationRequest, TokenResponse } from '@/types/auth'
import type { User } from '@/types/user'

// Вход и регистрация выполняются без сессии: старый токен не подставляется, а 401 означает
// неверные данные, а не истёкшую сессию (см. `skipAuth` в `@/api/http`)
const GUEST_REQUEST = { api: 'auth', skipAuth: true } as const

/** `POST /auth/token` — вход по email и паролю. */
export async function login(credentials: LoginRequest): Promise<TokenResponse> {
  const { data } = await http.post<TokenResponse>('/token', credentials, GUEST_REQUEST)
  return data
}

/** `POST /auth/registration` — создание пользователя; токены не выдаёт, после неё нужен вход. */
export async function register(form: RegistrationRequest): Promise<User> {
  const { data } = await http.post<User>('/registration', form, GUEST_REQUEST)
  return data
}

/** `GET /auth/me` — текущий пользователь по токену сессии; 401 сбрасывает сессию (см. `@/api/client`). */
export async function getCurrentUser(): Promise<User> {
  const { data } = await http.get<User>('/me', { api: 'auth' })
  return data
}
