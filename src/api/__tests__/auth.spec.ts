import { describe, expect, it, vi } from 'vitest'

import { getCurrentUser, login, register, updateCurrentUser } from '@/api/auth'
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
    const form = { ...credentials, password_confirmation: credentials.password }
    const user = { uid: '3fa85f64-5717-4562-b3fc-2c963f66afa6', name: null, email: form.email }
    const post = vi.spyOn(http, 'post').mockResolvedValue({ data: user })

    await expect(register(form)).resolves.toEqual(user)

    expect(post).toHaveBeenCalledWith('/registration', form, { api: 'auth', skipAuth: true })
  })

  it('getCurrentUser отправляет GET /me в API авторизации с токеном сессии', async () => {
    const user = {
      uid: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      name: 'Артём',
      email: 'a@example.com',
    }
    const get = vi.spyOn(http, 'get').mockResolvedValue({ data: user })

    await expect(getCurrentUser()).resolves.toEqual(user)

    expect(get).toHaveBeenCalledWith('/me', { api: 'auth' })
  })

  it('updateCurrentUser отправляет PATCH /me в API авторизации с токеном сессии', async () => {
    const user = {
      uid: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      name: 'Артём',
      email: 'a@example.com',
    }
    const patch = vi.spyOn(http, 'patch').mockResolvedValue({ data: user })

    await expect(updateCurrentUser({ name: 'Артём' })).resolves.toEqual(user)

    expect(patch).toHaveBeenCalledWith('/me', { name: 'Артём' }, { api: 'auth' })
  })
})
