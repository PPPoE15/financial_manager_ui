/** Пользователь, как его отдаёт `GET /auth/me`; `name = null` — имя ещё не задано в окне «Первый шаг». */
export interface User {
  uid: string
  name: string | null
  email: string
}

/** Тело `PATCH /auth/me`. */
export interface UserUpdate {
  name: string
}
