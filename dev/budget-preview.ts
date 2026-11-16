// Изолированный стенд: тестовые ответы API, без обращения к backend и записи токена в storage.
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, RouterView } from 'vue-router'
import { http } from '../src/api/client'
import { createAppRouter } from '../src/router'
import { useSessionStore } from '../src/stores/session'
import '../src/assets/main.css'

const params = new URLSearchParams(location.search)
// Одинаковые данные для снимков до/после; месяцы и суммы не зависят от часов компьютера.
const months = Array.from({ length: 12 }, (_, index) => ({
  month: index + 1,
  fact: index < 9 ? (index === 0 ? 0 : 12345) : null,
}))
const rows = Array.from({ length: params.has('dense') ? 25 : 6 }, (_, index) => ({
  category: {
    uid: `preview-${index}`,
    name: [
      'продукты и хозтовары',
      'подарки',
      'ЖИЛИЩНО-КОММУНАЛЬНЫЕ УСЛУГИ И РЕМОНТ',
      'образование',
      'транспорт',
      'отдых',
    ][index % 6]!,
  },
  money_plan: index === 1 ? null : 15000,
  average: index === 1 ? null : index === 3 ? 0 : 12345,
  months,
}))
let requests = 0

const pinia = createPinia()
const session = useSessionStore(pinia)
session.user = {
  uid: 'preview',
  name: params.get('name') ?? 'Артём',
  email: 'preview@example.com',
}
http.defaults.adapter = async (config) => {
  if (config.url === '/budget-structure') {
    requests++
    if (params.has('loading')) await new Promise((resolve) => setTimeout(resolve, 3000))
    if (params.has('error') && requests === 1) throw new Error('Ошибка стенда')
  }
  return {
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data:
      config.url === '/budget-structure'
        ? {
            year: config.params.year,
            category_type: config.params.category_type,
            rows: params.has('empty') ? [] : rows,
            total: {
              money_plan: (rows.length - 1) * 15000,
              average: (rows.length - 2) * 12345,
              months,
            },
          }
        : config.url === '/categories'
          ? { content: [], total: 0 }
          : config.url === '/transactions'
            ? { content: [], total: 0 }
            : { amount: 0 },
  }
}

const router = createAppRouter(createMemoryHistory(), [])
await router.push('/')
await router.isReady()
createApp(RouterView).use(pinia).use(router).mount('#app')
