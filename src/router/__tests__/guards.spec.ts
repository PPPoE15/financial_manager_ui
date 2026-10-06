import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'

import { HOME_ROUTE, LOGIN_ROUTE, REGISTER_ROUTE, createAppRouter } from '@/router'
import { guestOnlyGuard } from '@/router/guards'
import { useSessionStore } from '@/stores/session'

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
