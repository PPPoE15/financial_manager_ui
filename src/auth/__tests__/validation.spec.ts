import { describe, expect, it } from 'vitest'

import { validateLogin, validateRegistration } from '@/auth/validation'
import type { RegistrationRequest } from '@/types/auth'

const validRegistration: RegistrationRequest = {
  name: 'Артём',
  email: 'name@example.com',
  password: 's3cret-Passw0rd',
  password_confirmation: 's3cret-Passw0rd',
}

describe('validateLogin', () => {
  it('корректные данные проходят без ошибок', () => {
    expect(validateLogin({ email: 'name@example.com', password: 'secret' })).toEqual({})
  })

  it('пустые поля обязательны', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({
      email: 'Введите электронную почту',
      password: 'Введите пароль',
    })
  })

  it('почта из одних пробелов считается пустой', () => {
    expect(validateLogin({ email: '   ', password: 'secret' })).toEqual({
      email: 'Введите электронную почту',
    })
  })

  it('почта без @ отклоняется', () => {
    expect(validateLogin({ email: 'name.example.com', password: 'secret' })).toEqual({
      email: 'Введите корректный адрес электронной почты',
    })
  })
})

describe('validateRegistration', () => {
  it('корректные данные проходят без ошибок', () => {
    expect(validateRegistration(validRegistration)).toEqual({})
  })

  it('все поля обязательны', () => {
    expect(
      validateRegistration({ name: ' ', email: '', password: '', password_confirmation: '' }),
    ).toEqual({
      name: 'Введите, как к вам обращаться',
      email: 'Введите электронную почту',
      password: 'Введите пароль',
      password_confirmation: 'Повторите пароль',
    })
  })

  it('имя не длиннее 64 символов', () => {
    expect(validateRegistration({ ...validRegistration, name: 'я'.repeat(65) })).toEqual({
      name: 'Не длиннее 64 символов',
    })
    expect(validateRegistration({ ...validRegistration, name: 'я'.repeat(64) })).toEqual({})
  })

  it('пароль от 8 до 128 символов', () => {
    const short = 'a'.repeat(7)
    const long = 'a'.repeat(129)

    expect(
      validateRegistration({ ...validRegistration, password: short, password_confirmation: short }),
    ).toEqual({ password: 'Пароль должен быть не короче 8 символов' })
    expect(
      validateRegistration({ ...validRegistration, password: long, password_confirmation: long }),
    ).toEqual({ password: 'Пароль должен быть не длиннее 128 символов' })
  })

  it('пароль и подтверждение должны совпадать', () => {
    expect(
      validateRegistration({ ...validRegistration, password_confirmation: 'другой-пароль' }),
    ).toEqual({ password_confirmation: 'Пароли не совпадают' })
  })

  it('почта без @ отклоняется', () => {
    expect(validateRegistration({ ...validRegistration, email: 'name' })).toEqual({
      email: 'Введите корректный адрес электронной почты',
    })
  })
})
