import {
  createRouter,
  createWebHistory,
  type NavigationGuard,
  type Router,
  type RouterHistory,
} from 'vue-router'

import { guards as appGuards } from '@/router/guards'

export const HOME_ROUTE = 'home'
export const LOGIN_ROUTE = 'login'

export function createAppRouter(
  history: RouterHistory,
  guards: NavigationGuard[] = appGuards,
): Router {
  const router = createRouter({
    history,
    routes: [
      { path: '/', name: HOME_ROUTE, component: () => import('@/views/HomeView.vue') },
      { path: '/login', name: LOGIN_ROUTE, component: () => import('@/views/LoginView.vue') },
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
