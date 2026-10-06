/** Тело `POST /auth/token`. */
export interface LoginRequest {
  email: string
  password: string
}

/** Тело `POST /auth/registration`. */
export interface RegistrationRequest {
  name: string
  email: string
  password: string
  password_confirmation: string
}

/**
 * Ответ `POST /auth/token`. По контракту в нём есть ещё `refresh_token` и `expires_in`,
 * их сервис начнёт отдавать в FM-16, а фронт — использовать в FM-17.
 */
export interface TokenResponse {
  access_token: string
  token_type: string
}
