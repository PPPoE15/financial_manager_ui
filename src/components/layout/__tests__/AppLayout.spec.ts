import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, RouterView, type Router } from 'vue-router'

import { getCurrentUser } from '@/api/auth'
import { HOME_ROUTE, LOGIN_ROUTE, createAppRouter } from '@/router'
import { TOKEN_STORAGE_KEY, useSessionStore } from '@/stores/session'

vi.mock('@/api/auth', () => ({ login: vi.fn(), register: vi.fn(), getCurrentUser: vi.fn() }))

const user = { uid: '3fa85f64-5717-4562-b3fc-2c963f66afa6', name: 'Артём', email: 'a@example.com' }

let router: Router
let wrapper: VueWrapper | undefined

/** Приложение целиком (корневой RouterView + настоящие guard-ы), открытое на главной после входа. */
async function mountSignedIn() {
  useSessionStore().setToken('token')
  router = createAppRouter(createMemoryHistory())
  await router.push({ name: HOME_ROUTE })
  await router.isReady()
  wrapper = mount(RouterView, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

// Экран входа подгружается отдельным чанком — переход завершается не за один flushPromises
async function signOut(w: VueWrapper) {
  await logoutButton(w).trigger('click')
  await vi.waitFor(() => expect(router.currentRoute.value.name).toBe(LOGIN_ROUTE))
}

function logoutButton(w: VueWrapper) {
  const button = w.findAll('button').find((b) => b.text() === 'Выход')
  if (!button) throw new Error('Нет кнопки «Выход»')
  return button
}

describe('AppLayout (защищённая оболочка)', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.mocked(getCurrentUser).mockReset().mockResolvedValue(user)
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  it('показывает имя текущего пользователя из /auth/me', async () => {
    const w = await mountSignedIn()

    expect(w.get('[data-testid="current-user"]').text()).toContain('Артём')
    expect(w.get('[data-testid="user-avatar"]').text()).toBe('А')
  })

  it('пункт меню «Обзор» ведёт на главную и отмечен как текущий', async () => {
    const w = await mountSignedIn()

    const link = w.get('nav a')
    expect(link.text()).toBe('Обзор')
    expect(link.attributes('href')).toBe('/')
    expect(link.attributes('aria-current')).toBe('page')
  })

  it('кнопка «Выход» — обычная кнопка, доступная с клавиатуры', async () => {
    const w = await mountSignedIn()
    const button = logoutButton(w)

    expect(button.element.tagName).toBe('BUTTON')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('tabindex')).toBeUndefined()
    ;(button.element as HTMLButtonElement).focus()
    expect(document.activeElement).toBe(button.element)
  })

  it('«Выход» очищает сессию и ведёт на экран входа', async () => {
    const w = await mountSignedIn()

    await signOut(w)

    const session = useSessionStore()
    expect(session.token).toBeNull()
    expect(session.user).toBeNull()
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
  })

  it('после выхода «Назад» в браузере ведёт на экран входа', async () => {
    const w = await mountSignedIn()
    await signOut(w)

    router.back()
    await flushPromises()

    expect(router.currentRoute.value.name).toBe(LOGIN_ROUTE)
  })

  it('после выхода открытие защищённого URL ведёт на экран входа', async () => {
    const w = await mountSignedIn()
    await signOut(w)

    await router.push('/')

    expect(router.currentRoute.value.name).toBe(LOGIN_ROUTE)
  })
})
