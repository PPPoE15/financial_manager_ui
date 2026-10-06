import {
  createRouter,
  createWebHistory,
  type NavigationGuard,
  type Router,
  type RouterHistory,
} from 'vue-router'

import { guards as appGuards } from '@/router/guards'
import { HOME_ROUTE, LOGIN_ROUTE, REGISTER_ROUTE } from '@/router/names'

export { HOME_ROUTE, LOGIN_ROUTE, REGISTER_ROUTE } from '@/router/names'

export function createAppRouter(
  history: RouterHistory,
  guards: NavigationGuard[] = appGuards,
): Router {
  const router = createRouter({
    history,
    routes: [
      { path: '/', name: HOME_ROUTE, component: () => import('@/views/HomeView.vue') },
      // Вход и регистрация — один экран с двумя режимами; режим задаёт маршрут, чтобы вкладку
      // можно было открыть по ссылке и вернуться к ней кнопкой «Назад»
      {
        path: '/login',
        name: LOGIN_ROUTE,
        component: () => import('@/views/LoginView.vue'),
        meta: { guestOnly: true },
      },
      {
        path: '/register',
        name: REGISTER_ROUTE,
        component: () => import('@/views/LoginView.vue'),
        meta: { guestOnly: true },
      },
      { path: '/:pathMatch(.*)*', redirect: { name: HOME_ROUTE } },
    ],
  })

  for (const guard of guards) {
    router.beforeEach(guard)
  }

  return router
}

/** Переводит на экран входа, если пользователь ещё не там. */
export function redirectToLogin(router: Router): void {
  if (router.currentRoute.value.name !== LOGIN_ROUTE) {
    void router.push({ name: LOGIN_ROUTE })
  }
}

const router = createAppRouter(createWebHistory(import.meta.env.BASE_URL))

export default router
