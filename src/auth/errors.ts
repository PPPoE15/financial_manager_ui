import { isAxiosError } from 'axios'

import type { RegistrationRequest } from '@/types/auth'

export const NETWORK_ERROR = 'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз'
export const SERVER_ERROR = 'Сервер временно недоступен. Попробуйте позже'
export const GENERIC_ERROR = 'Не удалось выполнить запрос. Попробуйте ещё раз'

type AuthField = keyof RegistrationRequest

/** Ошибка ответа бэкенда, разложенная для формы: общее сообщение и/или ошибки у полей. */
export interface AuthFormError {
  message: string | null
  fields: Partial<Record<AuthField, string>>
}

/** Ошибка в формате RFC 7807 из contracts/auth.openapi.yaml (`ErrorResponse` / `ValidationErrorResponse`). */
interface ProblemResponse {
  code?: string
  validation?: { field?: string }[]
}

// Сообщения бэкенда в 422 приходят от pydantic на английском, поэтому показываем свои — по имени поля
// TODO(FM-12): тексты описывают только длину, а 422 бывает и по другим правилам (управляющие символы в имени
// не проверяются на клиенте) — тогда сообщение вводит в заблуждение. Числа 64/8/128 продублированы
// из констант validation.ts — вынести общие ограничения в один модуль.
const FIELD_FORMAT_ERRORS: Record<AuthField, string> = {
  name: 'Проверьте, как к вам обращаться: от 1 до 64 символов',
  email: 'Проверьте адрес электронной почты',
  password: 'Пароль должен быть от 8 до 128 символов',
  password_confirmation: 'Пароль должен быть от 8 до 128 символов',
}

function isAuthField(field: string | undefined): field is AuthField {
  return field !== undefined && Object.prototype.hasOwnProperty.call(FIELD_FORMAT_ERRORS, field)
}

// NOTE(FM-12): ошибки раскладываются по всем полям регистрации; на форме входа поле, которого на ней нет
// (например, name), молча потеряется. Сейчас недостижимо — вход отправляет только email и password.
function validationErrors(data: ProblemResponse): AuthFormError {
  const fields: AuthFormError['fields'] = {}
  for (const { field } of data.validation ?? []) {
    if (isAuthField(field)) {
      fields[field] = FIELD_FORMAT_ERRORS[field]
    }
  }
  return Object.keys(fields).length
    ? { message: null, fields }
    : { message: 'Проверьте введённые данные', fields: {} }
}

/** Сопоставляет ошибку запроса входа или регистрации с сообщениями для формы. */
export function mapAuthError(error: unknown): AuthFormError {
  if (!isAxiosError(error)) {
    return { message: GENERIC_ERROR, fields: {} }
  }
  if (!error.response) {
    return { message: NETWORK_ERROR, fields: {} }
  }

  const { status } = error.response
  const data = (error.response.data ?? {}) as ProblemResponse

  if (status >= 500) return { message: SERVER_ERROR, fields: {} }
  if (status === 401) return { message: 'Неверный email или пароль', fields: {} }
  if (status === 409 && data.code === 'FM-409001') {
    return { message: null, fields: { email: 'Пользователь с такой почтой уже зарегистрирован' } }
  }
  // Голый 400 бывает и от ошибки разбора тела (FM-19), поэтому ориентируемся на код, а не на статус
  if (status === 400 && data.code === 'FM-400001') {
    return { message: null, fields: { password_confirmation: 'Пароли не совпадают' } }
  }
  if (status === 422) return validationErrors(data)

  return { message: GENERIC_ERROR, fields: {} }
}
