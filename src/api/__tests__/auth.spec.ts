import { describe, expect, it, vi } from 'vitest'

import { login, register } from '@/api/auth'
import { http } from '@/api/client'

const credentials = { email: 'name@example.com', password: 's3cret-Passw0rd' }

describe('API авторизации', () => {
  it('login отправляет POST /token в API авторизации без токена сессии', async () => {
    const tokens = { access_token: 'access', token_type: 'bearer' }
    const post = vi.spyOn(http, 'post').mockResolvedValue({ data: tokens })

    await expect(login(credentials)).resolves.toEqual(tokens)

    expect(post).toHaveBeenCalledWith('/token', credentials, { api: 'auth', skipAuth: true })
  })

  it('register отправляет POST /registration в API авторизации без токена сессии', async () => {
    const form = { ...credentials, name: 'Артём', password_confirmation: credentials.password }
    const user = { uid: '3fa85f64-5717-4562-b3fc-2c963f66afa6', name: 'Артём', email: form.email }
    const post = vi.spyOn(http, 'post').mockResolvedValue({ data: user })

    await expect(register(form)).resolves.toEqual(user)

    expect(post).toHaveBeenCalledWith('/registration', form, { api: 'auth', skipAuth: true })
  })
})
