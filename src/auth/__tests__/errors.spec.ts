import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'

import { GENERIC_ERROR, NETWORK_ERROR, SERVER_ERROR, mapAuthError } from '@/auth/errors'

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig

function httpError(status: number, data: unknown = {}): AxiosError {
  return new AxiosError('Ошибка', String(status), config, null, {
    data,
    status,
    statusText: '',
    headers: {},
    config,
  })
}

function problem(status: number, code: string, validation?: { field: string; message: string }[]) {
  return httpError(status, {
    type: `/help-center?helpSectionId=errors#${status}`,
    title: 'Ошибка',
    status,
    detail: 'Текст бэкенда',
    instance: '/auth/registration',
    code,
    ...(validation && {
      validation: validation.map((v) => ({ ...v, rule: 'value_error', rejectedValue: null })),
    }),
  })
}

describe('mapAuthError', () => {
  it('401 при входе — неверные данные, без указания поля', () => {
    expect(mapAuthError(problem(401, 'FM-401001'))).toEqual({
      message: 'Неверный email или пароль',
      fields: {},
    })
  })

  it('409 FM-409001 — ошибка у поля почты', () => {
    expect(mapAuthError(problem(409, 'FM-409001'))).toEqual({
      message: null,
      fields: { email: 'Пользователь с такой почтой уже зарегистрирован' },
    })
  })

  it('400 FM-400001 — ошибка у подтверждения пароля', () => {
    expect(mapAuthError(problem(400, 'FM-400001'))).toEqual({
      message: null,
      fields: { password_confirmation: 'Пароли не совпадают' },
    })
  })

  it('422 — ошибки у полей из validation с русским текстом', () => {
    const error = problem(422, 'FM-422000', [
      { field: 'email', message: 'value is not a valid email address' },
      { field: 'password', message: 'String should have at least 8 characters' },
    ])

    expect(mapAuthError(error)).toEqual({
      message: null,
      fields: {
        email: 'Проверьте адрес электронной почты',
        password: 'Пароль должен быть от 8 до 128 символов',
      },
    })
  })

  it('422 без известных полей — общее сообщение', () => {
    const error = problem(422, 'FM-422000', [{ field: 'unknown', message: 'Extra inputs' }])

    expect(mapAuthError(error)).toEqual({ message: 'Проверьте введённые данные', fields: {} })
  })

  it('нет ответа от сервера — сообщение о связи', () => {
    const error = new AxiosError('Network Error', AxiosError.ERR_NETWORK, config)

    expect(mapAuthError(error)).toEqual({ message: NETWORK_ERROR, fields: {} })
  })

  it.each([500, 502, 503, 504])('%i — сервер недоступен', (status) => {
    expect(mapAuthError(httpError(status))).toEqual({ message: SERVER_ERROR, fields: {} })
  })

  it.each([400, 404, 413, 429])('прочий %i — общая ошибка', (status) => {
    expect(
      mapAuthError(httpError(status, { detail: 'There was an error parsing the body' })),
    ).toEqual({ message: GENERIC_ERROR, fields: {} })
  })

  it('не HTTP-ошибка — общая ошибка', () => {
    expect(mapAuthError(new Error('boom'))).toEqual({ message: GENERIC_ERROR, fields: {} })
  })
})
