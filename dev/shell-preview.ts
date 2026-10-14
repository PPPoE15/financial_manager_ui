// Изолированный стенд: пустые ответы API, без обращения к backend и записи токена в storage.
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, RouterView } from 'vue-router'
import { http } from '../src/api/client'
import { createAppRouter } from '../src/router'
import { useSessionStore } from '../src/stores/session'
import '../src/assets/main.css'

const pinia = createPinia()
const session = useSessionStore(pinia)
session.user = {
  uid: 'preview',
  name: new URLSearchParams(location.search).get('name') ?? 'Артём',
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
          rows: [],
          total: { money_plan: null, average: null, months: [] },
        }
      : { amount: 0 },
})
const router = createAppRouter(createMemoryHistory(), [])
await router.push('/')
await router.isReady()
createApp(RouterView).use(pinia).use(router).mount('#app')
