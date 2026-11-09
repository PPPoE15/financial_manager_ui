import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { http } from '../src/api/client'
import AppLayout from '../src/components/layout/AppLayout.vue'
import PlannedOperationsView from '../src/views/PlannedOperationsView.vue'
import type { PlannedOperation } from '../src/types/plannedOperation'
import type { Transaction } from '../src/types/transaction'
import '../src/assets/main.css'
const params = new URLSearchParams(location.search)
const categories = [
  { uid: 'c1', name: 'ЖКХ', category_type: 'outcome' },
  { uid: 'c2', name: 'Продукты и хозтовары', category_type: 'outcome' },
  { uid: 'c3', name: 'Подработка', category_type: 'income' },
]
let rows: PlannedOperation[] = params.has('empty')
  ? []
  : ['2026-11-07', '2026-11-09', '2026-11-09', '2026-11-12', '2026-11-15'].map(
      /** Создаёт вымышленные планы для ручной проверки. */ (planned_date, index) => ({
        uid: `p${index}`,
        planned_date,
        money_sum: [11500, 5000, 25000, 3200, 60000][index]!,
        category: categories[index % 3]!,
        transaction_type: index % 3 === 2 ? 'income' : 'outcome',
        description: 'Комментарий к операции',
        version: 1,
        status: 'pending',
        completed_at: null,
        transaction_uid: null,
        transaction_state: 'none',
        today: '2026-11-09',
        timezone: 'Europe/Moscow',
      }),
    )
const facts = new Map<string, Transaction>()
http.defaults.adapter =
  /** Имитирует API только на отдельной странице разработки без сетевых записей. */ async (
    config,
  ) => {
    const url = config.url ?? ''
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    let data: unknown = {}
    if (url === '/categories')
      data = {
        content: categories.filter(
          /** Выбирает категории указанного типа. */ (c) =>
            c.category_type === config.params.category_type,
        ),
      }
    else if (url === '/planned-operations' && config.method === 'get') {
      if (params.has('error')) throw new Error('Ошибка стенда')
      const content = rows
        .filter(
          /** Применяет фильтры списка. */ (p) =>
            (config.params.include_completed || p.status === 'pending') &&
            (!config.params.transaction_type ||
              p.transaction_type === config.params.transaction_type),
        )
        .sort(
          /** Сортирует планы по дате. */ (a, b) => a.planned_date.localeCompare(b.planned_date),
        )
      data = {
        content,
        total: content.length,
        due_count: content.filter(
          /** Считает наступившие невыполненные. */ (p) =>
            p.status === 'pending' && p.planned_date <= '2026-11-09',
        ).length,
        next_skip: null,
        today: '2026-11-09',
        timezone: 'Europe/Moscow',
      }
    } else if (url === '/planned-operations' && config.method === 'post') {
      const category = categories.find(
        /** Находит выбранную категорию. */ (c) => c.uid === body.category_uid,
      )!
      const plan: PlannedOperation = {
        ...body,
        uid: `new${rows.length}`,
        category,
        transaction_type: category.category_type as 'income' | 'outcome',
        version: 1,
        status: 'pending',
        completed_at: null,
        transaction_uid: null,
        transaction_state: 'none',
        today: '2026-11-09',
        timezone: 'Europe/Moscow',
      }
      rows.push(plan)
      data = plan
      if (params.has('unknown')) throw new Error('Ответ потерян')
    } else if (url.startsWith('/planned-operations/')) {
      const uid = url.split('/')[2]!
      const plan = rows.find(/** Находит выбранный план. */ (p) => p.uid === uid)!
      if (config.method === 'delete')
        rows = rows.filter(/** Удаляет только план. */ (p) => p.uid !== uid)
      else if (url.endsWith('/confirm')) {
        const transaction: Transaction = {
          ...body,
          uid: `fact${uid}`,
          version: 1,
          category: categories.find(
            /** Находит категорию факта. */ (c) => c.uid === body.category_uid,
          )!,
          transaction_type: plan.transaction_type,
        }
        facts.set(transaction.uid, transaction)
        Object.assign(plan, {
          status: 'completed',
          completed_at: '2026-11-09T12:00:00Z',
          transaction_state: 'available',
          transaction_uid: transaction.uid,
          version: plan.version + 1,
        })
        data = { plan: { ...plan }, transaction }
      } else {
        if (config.method === 'patch') Object.assign(plan, body, { version: plan.version + 1 })
        data = { ...plan }
      }
    } else if (url.startsWith('/transactions/')) data = facts.get(url.split('/')[2]!)
    else if (url === '/transactions')
      data = { content: [...facts.values()], total: facts.size, next_skip: null }
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/',
      component: AppLayout,
      children: [
        { path: '', name: 'planned-operations', component: PlannedOperationsView },
        { path: 'home', name: 'home', component: PlannedOperationsView },
      ],
    },
  ],
})
await router.push('/')
// Корневой RouterView передаётся компонентом, чтобы Vue не трактовал имя как HTML-тег.
const { RouterView } = await import('vue-router')
createApp({
  render: /** Монтирует тестовый экран с настоящим маршрутизатором. */ () => h(RouterView),
})
  .use(createPinia())
  .use(router)
  .mount('#app')
