import { beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { logout } from '@/api/auth'
import { useSignOut } from '@/auth/useSignOut'
import { useSessionStore } from '@/stores/session'
const push = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/api/auth', () => ({ logout: vi.fn() }))
beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.mocked(logout).mockReset()
  push.mockReset()
})
it.each([false, true])('отзывает refresh и очищает сессию даже при ошибке: %s', async (fails) => {
  const session = useSessionStore()
  session.setToken('access')
  if (fails) vi.mocked(logout).mockRejectedValue(new Error('network'))
  await useSignOut()()
  expect(logout).toHaveBeenCalledOnce()
  expect(session.token).toBeNull()
  expect(push).toHaveBeenCalledWith({ name: 'login' })
})
