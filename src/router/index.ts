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
      // Защищённые экраны — внутри общего каркаса (боковая панель с пользователем и «Выход»)
      {
        path: '/',
        component: () => import('@/components/layout/AppLayout.vue'),
        children: [{ path: '', name: HOME_ROUTE, component: () => import('@/views/HomeView.vue') }],
      },
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
      // NOTE(FM-13): неизвестный путь уводит на главную раньше guard-ов — без входа в `redirect` попадёт
      // `/`, а не исходный незарегистрированный адрес.
      { path: '/:pathMatch(.*)*', redirect: { name: HOME_ROUTE } },
    ],
  })

  for (const guard of guards) {
    router.beforeEach(guard)
  }

  return router
}

/** Переводит на экран входа, если пользователь ещё не там. */
// TODO(FM-17): на 401 от последующих запросов ведёт на вход без `redirect` — после повторного входа
// пользователь окажется на главной, а не на текущем экране; учесть при переработке 401 и выхода.
export function redirectToLogin(router: Router): void {
  if (router.currentRoute.value.name !== LOGIN_ROUTE) {
    void router.push({ name: LOGIN_ROUTE })
  }
}

const router = createAppRouter(createWebHistory(import.meta.env.BASE_URL))

export default router
