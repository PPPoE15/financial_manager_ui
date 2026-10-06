import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { createMemoryHistory, type Router } from 'vue-router'

import { login, register } from '@/api/auth'
import { HOME_ROUTE, LOGIN_ROUTE, REGISTER_ROUTE, createAppRouter } from '@/router'
import { useSessionStore } from '@/stores/session'
import LoginView from '@/views/LoginView.vue'

vi.mock('@/api/auth', () => ({ login: vi.fn(), register: vi.fn() }))

const tokens = { access_token: 'access-token', token_type: 'bearer' }
const user = {
  uid: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  name: 'Артём',
  email: 'name@example.com',
}

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig

function httpError(status: number, code: string): AxiosError {
  return new AxiosError('Ошибка', String(status), config, null, {
    data: { status, code, detail: 'Текст бэкенда' },
    status,
    statusText: '',
    headers: {},
    config,
  })
}

/** Промис, который тест разрешает сам — чтобы проверить состояние формы во время запроса. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

let router: Router
let wrapper: VueWrapper | undefined

async function mountAt(name: string) {
  router = createAppRouter(createMemoryHistory())
  await router.push({ name })
  await router.isReady()
  wrapper = mount(LoginView, { global: { plugins: [router] }, attachTo: document.body })
  return wrapper
}

function field(w: VueWrapper, label: string) {
  const labelEl = w.findAll('label').find((l) => l.text() === label)
  if (!labelEl) throw new Error(`Нет поля «${label}»`)
  return w.get(`#${labelEl.attributes('for')}`)
}

function fieldError(w: VueWrapper, label: string) {
  const describedBy = field(w, label).attributes('aria-describedby')
  return describedBy ? w.find(`#${describedBy}`).text() : null
}

function submitButton(w: VueWrapper) {
  return w.get('form button[type="submit"]')
}

async function fillLogin(w: VueWrapper) {
  await field(w, 'Электронная почта').setValue(' name@example.com ')
  await field(w, 'Пароль').setValue('s3cret-Passw0rd')
}

async function fillRegistration(w: VueWrapper) {
  await field(w, 'Как к вам обращаться').setValue(' Артём ')
  await field(w, 'Электронная почта').setValue('name@example.com')
  await field(w, 'Пароль').setValue('s3cret-Passw0rd')
  await field(w, 'Подтвердите пароль').setValue('s3cret-Passw0rd')
}

describe('LoginView', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.mocked(login).mockReset()
    vi.mocked(register).mockReset()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  describe('режим «Вход»', () => {
    it('показывает тексты и поля из макета', async () => {
      const w = await mountAt(LOGIN_ROUTE)

      expect(w.get('h1').text()).toBe('С возвращением!')
      expect(w.get('h2').text()).toBe('Войти в аккаунт')
      expect(field(w, 'Электронная почта').attributes('placeholder')).toBe('name@example.com')
      expect(field(w, 'Пароль').attributes('placeholder')).toBe('Введите пароль')
      expect(field(w, 'Пароль').attributes('type')).toBe('password')
      expect(submitButton(w).text()).toBe('Войти')
      expect(w.findAll('label').map((l) => l.text())).toEqual(['Электронная почта', 'Пароль'])
    })

    it('вкладка «Вход» активна, «Регистрация» ведёт на регистрацию', async () => {
      const w = await mountAt(LOGIN_ROUTE)
      const tabs = w.findAll('nav a')

      expect(tabs.map((t) => t.text())).toEqual(['Вход', 'Регистрация'])
      expect(tabs[0]?.attributes('aria-current')).toBe('page')
      expect(tabs[1]?.attributes('aria-current')).toBeUndefined()

      await tabs[1]?.trigger('click')
      await flushPromises()

      expect(router.currentRoute.value.name).toBe(REGISTER_ROUTE)
      expect(w.get('h2').text()).toBe('Создать аккаунт')
    })

    it('пустая форма показывает ошибки у полей и не отправляет запрос', async () => {
      const w = await mountAt(LOGIN_ROUTE)

      await w.get('form').trigger('submit')
      await flushPromises()

      expect(fieldError(w, 'Электронная почта')).toBe('Введите электронную почту')
      expect(fieldError(w, 'Пароль')).toBe('Введите пароль')
      expect(login).not.toHaveBeenCalled()
    })

    it('успешный вход сохраняет токен и ведёт на главную', async () => {
      vi.mocked(login).mockResolvedValue(tokens)
      const w = await mountAt(LOGIN_ROUTE)
      await fillLogin(w)

      await w.get('form').trigger('submit')
      await flushPromises()

      expect(login).toHaveBeenCalledWith({ email: 'name@example.com', password: 's3cret-Passw0rd' })
      expect(useSessionStore().token).toBe('access-token')
      await vi.waitFor(() => expect(router.currentRoute.value.name).toBe(HOME_ROUTE))
    })

    it('неверный пароль — сообщение над кнопкой, без alert', async () => {
      const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
      vi.mocked(login).mockRejectedValue(httpError(401, 'FM-401001'))
      const w = await mountAt(LOGIN_ROUTE)
      await fillLogin(w)

      await w.get('form').trigger('submit')
      await flushPromises()

      const message = w.get('[data-testid="form-error"]')
      expect(message.text()).toBe('Неверный email или пароль')
      expect(message.attributes('role')).toBe('alert')
      expect(alert).not.toHaveBeenCalled()
      expect(useSessionStore().token).toBeNull()
      expect(router.currentRoute.value.name).toBe(LOGIN_ROUTE)
    })

    it('во время запроса кнопка заблокирована, повторная отправка не уходит', async () => {
      const request = deferred<typeof tokens>()
      vi.mocked(login).mockReturnValue(request.promise)
      const w = await mountAt(LOGIN_ROUTE)
      await fillLogin(w)

      await w.get('form').trigger('submit')
      await w.get('form').trigger('submit')
      await submitButton(w).trigger('click')

      expect(submitButton(w).attributes('disabled')).toBeDefined()
      expect(submitButton(w).attributes('aria-busy')).toBe('true')
      expect(login).toHaveBeenCalledOnce()

      request.resolve(tokens)
      await flushPromises()
      await vi.waitFor(() => expect(router.currentRoute.value.name).toBe(HOME_ROUTE))
    })

    it('после ошибки кнопка снова доступна', async () => {
      vi.mocked(login).mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK', config))
      const w = await mountAt(LOGIN_ROUTE)
      await fillLogin(w)

      await w.get('form').trigger('submit')
      await flushPromises()

      expect(submitButton(w).attributes('disabled')).toBeUndefined()
      expect(w.get('[data-testid="form-error"]').text()).toContain('Нет связи с сервером')
    })

    it('Enter в поле отправляет форму (кнопка — submit, форма без нативной валидации)', async () => {
      const w = await mountAt(LOGIN_ROUTE)

      expect(submitButton(w).attributes('type')).toBe('submit')
      expect(w.get('form').attributes('novalidate')).toBeDefined()
    })
  })

  describe('режим «Регистрация»', () => {
    it('показывает тексты и поля из макета', async () => {
      const w = await mountAt(REGISTER_ROUTE)

      expect(w.get('h1').text()).toBe('Добро пожаловать!')
      expect(w.get('h2').text()).toBe('Создать аккаунт')
      expect(w.findAll('label').map((l) => l.text())).toEqual([
        'Как к вам обращаться',
        'Электронная почта',
        'Пароль',
        'Подтвердите пароль',
      ])
      expect(field(w, 'Как к вам обращаться').attributes('placeholder')).toBe('Имя')
      expect(field(w, 'Подтвердите пароль').attributes('placeholder')).toBe(
        'Введите пароль еще раз',
      )
      expect(submitButton(w).text()).toBe('Зарегистрироваться')
      expect(w.findAll('nav a')[1]?.attributes('aria-current')).toBe('page')
    })

    it('несовпадающие пароли — ошибка у подтверждения, запрос не уходит', async () => {
      const w = await mountAt(REGISTER_ROUTE)
      await fillRegistration(w)
      await field(w, 'Подтвердите пароль').setValue('другой-пароль')

      await w.get('form').trigger('submit')
      await flushPromises()

      expect(fieldError(w, 'Подтвердите пароль')).toBe('Пароли не совпадают')
      expect(register).not.toHaveBeenCalled()
    })

    it('после регистрации выполняет вход и ведёт на главную', async () => {
      vi.mocked(register).mockResolvedValue(user)
      vi.mocked(login).mockResolvedValue(tokens)
      const w = await mountAt(REGISTER_ROUTE)
      await fillRegistration(w)

      await w.get('form').trigger('submit')
      await flushPromises()

      expect(register).toHaveBeenCalledWith({
        name: 'Артём',
        email: 'name@example.com',
        password: 's3cret-Passw0rd',
        password_confirmation: 's3cret-Passw0rd',
      })
      expect(login).toHaveBeenCalledWith({ email: 'name@example.com', password: 's3cret-Passw0rd' })
      expect(useSessionStore().token).toBe('access-token')
      await vi.waitFor(() => expect(router.currentRoute.value.name).toBe(HOME_ROUTE))
    })

    it('занятый email — ошибка у поля почты', async () => {
      vi.mocked(register).mockRejectedValue(httpError(409, 'FM-409001'))
      const w = await mountAt(REGISTER_ROUTE)
      await fillRegistration(w)

      await w.get('form').trigger('submit')
      await flushPromises()

      expect(fieldError(w, 'Электронная почта')).toBe(
        'Пользователь с такой почтой уже зарегистрирован',
      )
      expect(login).not.toHaveBeenCalled()
    })

    it('аккаунт создан, но вход не удался — понятное сообщение', async () => {
      vi.mocked(register).mockResolvedValue(user)
      vi.mocked(login).mockRejectedValue(httpError(503, 'FM-503000'))
      const w = await mountAt(REGISTER_ROUTE)
      await fillRegistration(w)

      await w.get('form').trigger('submit')
      await flushPromises()

      expect(w.get('[data-testid="form-error"]').text()).toBe(
        'Аккаунт создан, но войти автоматически не удалось. Войдите на вкладке «Вход»',
      )
      expect(router.currentRoute.value.name).toBe(REGISTER_ROUTE)
    })
  })
})
