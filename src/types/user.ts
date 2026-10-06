/** Пользователь, как его отдаёт `GET /auth/me`. */
export interface User {
  uid: string
  name: string
  email: string
}
