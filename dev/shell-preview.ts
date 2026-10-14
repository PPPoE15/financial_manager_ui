// Изолированный стенд: тестовые ответы API, без обращения к backend и записи токена в storage.
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, RouterView } from 'vue-router'
import { http } from '../src/api/client'
import { createAppRouter } from '../src/router'
import { useSessionStore } from '../src/stores/session'
import '../src/assets/main.css'

const params = new URLSearchParams(location.search)
const months = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, fact: 12345 }))
const rows = params.has('filled')
  ? [
      {
        category: { uid: 'preview-category', name: 'Длинное название тестовой категории' },
        money_plan: 15000,
        average: 12345,
        months,
      },
    ]
  : []

const pinia = createPinia()
const session = useSessionStore(pinia)
session.user = {
  uid: 'preview',
  name: params.get('name') ?? 'Артём',
  email: 'preview@example.com',
}
http.defaults.adapter = async (config) => ({
  config,
  status: 200,
  statusText: 'OK',
  headers: {},
  data:
    config.url === '/budget-structure'
      ? {
          year: 2026,
          category_type: config.params.category_type,
          rows,
          total: {
            money_plan: rows.length ? 15000 : null,
            average: rows.length ? 12345 : null,
            months: rows.length ? months : [],
          },
        }
      : { amount: 0 },
})
const router = createAppRouter(createMemoryHistory(), [])
await router.push('/')
await router.isReady()
createApp(RouterView).use(pinia).use(router).mount('#app')
