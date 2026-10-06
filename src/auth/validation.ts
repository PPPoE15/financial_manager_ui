import type { LoginRequest, RegistrationRequest } from '@/types/auth'

/** Ошибки формы: поле → текст ошибки. Поля без ошибок отсутствуют. */
export type FieldErrors<T> = Partial<Record<keyof T, string>>

// Ограничения из contracts/auth.openapi.yaml; сервер проверяет их сам, здесь — чтобы не гонять заведомо
// неверный запрос и показать понятное сообщение сразу.
const NAME_MAX_LENGTH = 64
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 128
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Длина в символах Unicode, как её считает сервер (эмодзи — один символ, а не две UTF-16-единицы)
function length(value: string): number {
  return [...value].length
}

function emailError(email: string): string | undefined {
  const value = email.trim()
  if (!value) return 'Введите электронную почту'
  if (!EMAIL_PATTERN.test(value)) return 'Введите корректный адрес электронной почты'
  return undefined
}

function compact<T>(errors: Record<keyof T, string | undefined>): FieldErrors<T> {
  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message !== undefined),
  ) as FieldErrors<T>
}

export function validateLogin(form: LoginRequest): FieldErrors<LoginRequest> {
  return compact<LoginRequest>({
    email: emailError(form.email),
    // TODO(FM-12): сервер и при входе требует пароль 8–128 символов, и короткий неверный пароль даёт 422
    // («Пароль должен быть от 8 до 128 символов») вместо «Неверный email или пароль». Решить: проверять
    // длину и здесь или на форме входа показывать 422 по паролю как неверные данные.
    password: form.password ? undefined : 'Введите пароль',
  })
}

function passwordError(password: string): string | undefined {
  if (!password) return 'Введите пароль'
  if (length(password) < PASSWORD_MIN_LENGTH) {
    return `Пароль должен быть не короче ${PASSWORD_MIN_LENGTH} символов`
  }
  if (length(password) > PASSWORD_MAX_LENGTH) {
    return `Пароль должен быть не длиннее ${PASSWORD_MAX_LENGTH} символов`
  }
  return undefined
}

export function validateRegistration(form: RegistrationRequest): FieldErrors<RegistrationRequest> {
  const name = form.name.trim()
  let nameError: string | undefined
  if (!name) nameError = 'Введите, как к вам обращаться'
  else if (length(name) > NAME_MAX_LENGTH) nameError = `Не длиннее ${NAME_MAX_LENGTH} символов`

  let confirmationError: string | undefined
  if (!form.password_confirmation) confirmationError = 'Повторите пароль'
  else if (form.password && form.password_confirmation !== form.password) {
    confirmationError = 'Пароли не совпадают'
  }

  return compact<RegistrationRequest>({
    name: nameError,
    email: emailError(form.email),
    password: passwordError(form.password),
    password_confirmation: confirmationError,
  })
}
