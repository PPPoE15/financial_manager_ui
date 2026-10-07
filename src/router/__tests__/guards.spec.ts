import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'

import { getCurrentUser } from '@/api/auth'

import { HOME_ROUTE, LOGIN_ROUTE, REGISTER_ROUTE, createAppRouter } from '@/router'
import { authGuard, guestOnlyGuard } from '@/router/guards'
import { useSessionStore } from '@/stores/session'

vi.mock('@/api/auth', () => ({ getCurrentUser: vi.fn() }))

const user = { uid: '3fa85f64-5717-4562-b3fc-2c963f66afa6', name: 'Артём', email: 'a@example.com' }

describe('guestOnlyGuard', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it.each([LOGIN_ROUTE, REGISTER_ROUTE])(
    'пускает неавторизованного пользователя на %s',
    async (name) => {
      const router = createAppRouter(createMemoryHistory(), [guestOnlyGuard])

      await router.push({ name })

      expect(router.currentRoute.value.name).toBe(name)
    },
  )

  it.each([LOGIN_ROUTE, REGISTER_ROUTE])(
    'авторизованного пользователя с %s перенаправляет на главную',
    async (name) => {
      useSessionStore().setToken('token')
      const router = createAppRouter(createMemoryHistory(), [guestOnlyGuard])

      await router.push({ name })

      expect(router.currentRoute.value.name).toBe(HOME_ROUTE)
    },
  )

  it('не мешает авторизованному пользователю открывать остальные страницы', async () => {
    useSessionStore().setToken('token')
    const router = createAppRouter(createMemoryHistory(), [guestOnlyGuard])

    await router.push({ name: HOME_ROUTE })

    expect(router.currentRoute.value.name).toBe(HOME_ROUTE)
  })
})

describe('authGuard', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.mocked(getCurrentUser).mockReset()
  })

  function routerWithAuthGuard() {
    return createAppRouter(createMemoryHistory(), [authGuard])
  }

  it('без входа защищённый URL ведёт на экран входа и запоминает исходный адрес', async () => {
    const router = routerWithAuthGuard()

    await router.push('/')

    expect(router.currentRoute.value.name).toBe(LOGIN_ROUTE)
    expect(router.currentRoute.value.query.redirect).toBe('/')
    expect(getCurrentUser).not.toHaveBeenCalled()
  })

  it('без входа неизвестный адрес тоже ведёт на экран входа', async () => {
    const router = routerWithAuthGuard()

    await router.push('/unknown/nested')

    expect(router.currentRoute.value.name).toBe(LOGIN_ROUTE)
  })

  it.each([LOGIN_ROUTE, REGISTER_ROUTE])(
    'пускает неавторизованного пользователя на %s',
    async (name) => {
      const router = routerWithAuthGuard()

      await router.push({ name })

      expect(router.currentRoute.value.name).toBe(name)
    },
  )

  it('с токеном загружает текущего пользователя и пускает на защищённую страницу', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user)
    useSessionStore().setToken('token')
    const router = routerWithAuthGuard()

    await router.push({ name: HOME_ROUTE })

    expect(router.currentRoute.value.name).toBe(HOME_ROUTE)
    expect(useSessionStore().user).toEqual(user)
  })

  it('не запрашивает пользователя повторно, если он уже загружен', async () => {
    const session = useSessionStore()
    session.setToken('token')
    session.setUser(user)
    const router = routerWithAuthGuard()

    await router.push({ name: HOME_ROUTE })

    expect(router.currentRoute.value.name).toBe(HOME_ROUTE)
    expect(getCurrentUser).not.toHaveBeenCalled()
  })

  it('с истёкшим токеном ведёт на экран входа', async () => {
    // HTTP-клиент на 401 сам сбрасывает сессию (см. `@/api/client`) — повторяем это в моке
    vi.mocked(getCurrentUser).mockImplementation(async () => {
      useSessionStore().clear()
      throw new Error('401')
    })
    useSessionStore().setToken('expired')
    const router = routerWithAuthGuard()

    await router.push({ name: HOME_ROUTE })

    expect(router.currentRoute.value.name).toBe(LOGIN_ROUTE)
    expect(useSessionStore().token).toBeNull()
  })

  it('другая ошибка загрузки пользователя не закрывает доступ к странице', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('Network Error'))
    useSessionStore().setToken('token')
    const router = routerWithAuthGuard()

    await router.push({ name: HOME_ROUTE })

    expect(router.currentRoute.value.name).toBe(HOME_ROUTE)
    expect(useSessionStore().token).toBe('token')
    expect(useSessionStore().user).toBeNull()
  })
})
