import { useSessionStore } from '@/stores/session'
import type { SessionHttpClient } from '@/api/http'
import { http } from '@/api/client'
import type { LoginRequest, RegistrationRequest, TokenResponse } from '@/types/auth'
import type { User, UserUpdate } from '@/types/user'

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

/** `PATCH /auth/me` — изменение профиля (имя из окна «Первый шаг»), возвращает изменённого пользователя. */
export async function updateCurrentUser(body: UserUpdate): Promise<User> {
  const { data } = await http.patch<User>('/me', body, { api: 'auth' })
  return data
}

/** Отзыв и локальная очистка выполняются под той же блокировкой, что и ротация. */
export async function logoutSession(
  client: SessionHttpClient,
  session: ReturnType<typeof useSessionStore>,
): Promise<void> {
  session.sync()
  const generation = session.generation
  session.signingOut = true
  try {
    await client.waitForRefresh()
    await client.runSessionOperation(async () => {
      session.sync()
      if (generation !== session.generation) return
      try {
        if (session.refreshToken)
          await client.post(
            '/logout',
            {},
            {
              api: 'auth',
              refreshTokenBody: true,
              sessionLockHeld: Boolean(navigator.locks),
              sessionGeneration: generation,
            },
          )
      } finally {
        session.sync()
        if (generation === session.generation) session.clear()
      }
    }, true)
  } finally {
    session.sync()
    if (generation === session.generation) session.clear()
  }
}

export function logout(): Promise<void> {
  return logoutSession(http, useSessionStore())
}
