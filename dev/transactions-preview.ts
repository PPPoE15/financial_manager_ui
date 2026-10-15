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
const requests: Record<string, number> = {}

const pinia = createPinia()
const session = useSessionStore(pinia)
session.user = {
  uid: 'preview',
  name: params.get('name') ?? 'Артём',
  email: 'preview@example.com',
}
http.defaults.adapter = async (config) => {
  if (config.url === '/transactions') {
    const type = config.params.transaction_type
    requests[type] = (requests[type] ?? 0) + 1
    if (params.has('loading')) await new Promise(() => {})
    if (params.has('error') && requests[type] === 1) throw new Error('Ошибка стенда')
    const content = params.has('empty')
      ? []
      : Array.from({ length: 5 }, (_, index) => ({
          uid: `${type}-${index}`,
          transaction_type: type,
          transaction_date: `2026-10-${15 - index}T00:01:00`,
          category: {
            uid: `category-${index}`,
            name:
              type === 'income'
                ? [
                    'Зарплата',
                    'Подработка',
                    'Проценты по вкладу',
                    'Подарок',
                    'Длинное название статьи доходов',
                  ][index]
                : ['Продукты и хозтовары', 'ЖКХ', 'Транспорт', 'Образование', 'Отдых'][index],
          },
          money_sum: [12345, 1000000000, 4990, 1, 3200][index],
          description:
            index === 2
              ? null
              : 'Комментарий к записи, который может быть очень длинным и обрезается в строке',
        }))
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { total: content.length, content },
    }
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
