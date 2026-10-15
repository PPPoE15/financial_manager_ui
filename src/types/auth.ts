/** Тело `POST /auth/token`. */
export interface LoginRequest {
  email: string
  password: string
}

/** Тело `POST /auth/registration`; имя не передаётся — оно задаётся позже в окне «Первый шаг». */
export interface RegistrationRequest {
  email: string
  password: string
  password_confirmation: string
}

/** Пара токенов из `POST /auth/token` и `POST /auth/token/refresh`. */
export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}
