import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, type NavigationGuard } from 'vue-router'

import { HOME_ROUTE, LOGIN_ROUTE, createAppRouter, redirectToLogin } from '@/router'

describe('createAppRouter', () => {
  it('содержит маршруты главной и экрана входа', () => {
    const router = createAppRouter(createMemoryHistory())

    expect(router.resolve({ name: HOME_ROUTE }).path).toBe('/')
    expect(router.resolve({ name: LOGIN_ROUTE }).path).toBe('/login')
  })

  it('неизвестный путь перенаправляет на главную', async () => {
    const router = createAppRouter(createMemoryHistory())

    await router.push('/unknown/nested')

    expect(router.currentRoute.value.name).toBe(HOME_ROUTE)
  })

  it('подключает переданные guard-ы к каждому переходу', async () => {
    const guard = vi.fn<NavigationGuard>(() => true)
    const router = createAppRouter(createMemoryHistory(), [guard])

    await router.push({ name: LOGIN_ROUTE })

    expect(guard).toHaveBeenCalledOnce()
    expect(guard.mock.calls[0]?.[0].name).toBe(LOGIN_ROUTE)
  })

  it('guard может перенаправить переход', async () => {
    const toLogin: NavigationGuard = (to) =>
      to.name === LOGIN_ROUTE ? true : { name: LOGIN_ROUTE }
    const router = createAppRouter(createMemoryHistory(), [toLogin])

    await router.push({ name: HOME_ROUTE })

    expect(router.currentRoute.value.name).toBe(LOGIN_ROUTE)
  })

  it('redirectToLogin переводит на экран входа', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push({ name: HOME_ROUTE })
    const push = vi.spyOn(router, 'push')

    redirectToLogin(router)
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe(LOGIN_ROUTE))

    expect(push).toHaveBeenCalledWith({ name: LOGIN_ROUTE })
  })

  it('redirectToLogin не переходит повторно, если пользователь уже на экране входа', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push({ name: LOGIN_ROUTE })
    const push = vi.spyOn(router, 'push')

    redirectToLogin(router)

    expect(push).not.toHaveBeenCalled()
  })
})
