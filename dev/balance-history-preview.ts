// Стенд FM-88. ?api использует отдельный тестовый backend и токен из локального окружения.
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, RouterView } from 'vue-router'
import { http } from '../src/api/client'
import { createAppRouter } from '../src/router'
import { useSessionStore } from '../src/stores/session'
import '../src/assets/main.css'

const params = new URLSearchParams(location.search)
const pinia = createPinia()
const session = useSessionStore(pinia)
session.user = { uid: 'preview', name: 'Артём', email: 'preview@example.com' }
if (params.has('api')) {
  // Только память: тестовый токен не сохраняется в localStorage.
  session.token = import.meta.env.VITE_FM88_TEST_TOKEN
} else {
  let requests = 0
  http.defaults.adapter = /** Отвечает данными стенда без обращения к серверу. */ async (
    config,
  ) => {
    let data: unknown
    if (config.url === '/balance-history') {
      requests++
      if (params.has('loading'))
        await new Promise(/** Удерживает состояние загрузки для осмотра. */ () => {})
      if (params.has('error') && requests === 1) throw new Error('Ошибка стенда')
      const start = Date.parse(`${config.params.date_from}T00:00:00Z`)
      const end = Date.parse(`${config.params.date_to}T00:00:00Z`)
      data = {
        date_from: config.params.date_from,
        date_to: config.params.date_to,
        currency: 'RUB',
        unit: 'rubles',
        timezone: 'Europe/Moscow',
        points: Array.from(
          { length: (end - start) / 86400000 + 1 },
          /** Создаёт неизвестные дни, ноль, долг и положительные остатки. */ (_, index) => ({
            date: new Date(start + index * 86400000).toISOString().slice(0, 10),
            balance:
              params.has('unknown') || index < 2
                ? null
                : params.has('constant')
                  ? 0
                  : (index - 4) * 1200,
          }),
        ),
      }
    } else if (config.url === '/budget-structure') {
      data = {
        year: config.params.year,
        category_type: config.params.category_type,
        rows: [],
        total: { money_plan: null, average: null, months: [] },
      }
    } else if (config.url === '/starting-balance')
      data = { amount: 100, balance_date: '2026-10-01' }
    else data = { content: [], total: 0 }
    return { config, status: 200, statusText: 'OK', headers: {}, data }
  }
}
const router = createAppRouter(createMemoryHistory(), [])
await router.push('/')
await router.isReady()
createApp(RouterView).use(pinia).use(router).mount('#app')
