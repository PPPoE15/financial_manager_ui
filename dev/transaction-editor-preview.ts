import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { AxiosError } from 'axios'
import TransactionListDialog from '../src/components/transactions/TransactionListDialog.vue'
import { http } from '../src/api/client'
import type {
  Transaction,
  TransactionUpdateItem,
  TransactionVersionItem,
} from '../src/types/transaction'
import '../src/assets/main.css'
const params = new URLSearchParams(location.search)
const names = ['Продукты и хозтовары', 'ЖКХ', 'Транспорт', 'Еда вне дома']
let records: Transaction[] = Array.from(
  { length: params.has('empty') ? 0 : 124 },
  /** Создаёт детерминированные операции стенда. */ (_, i) => ({
    uid: `preview-${i}`,
    version: 1,
    transaction_date: `2026-11-${String(6 - Math.floor(i / 24)).padStart(2, '0')}T12:30:15.123456`,
    category: { uid: `c-${i % 4}`, name: names[i % 4]! },
    money_sum: 2650 + i * 10,
    description: i % 2 ? null : 'Покупки на неделю',
    transaction_type: i > 100 ? 'income' : 'outcome',
  }),
)
http.defaults.adapter = /** Имитирует API в памяти только на отдельной dev-странице. */ async (
  config,
) => {
  if (params.has('loading'))
    await new Promise(/** Удерживает запрос для проверки индикатора. */ () => {})
  if (params.has('error') && config.url === '/transactions') throw new Error('Ошибка стенда')
  let data: unknown
  if (config.url === '/categories')
    data = {
      total: 4,
      content: names.map(
        /** Возвращает статьи нужного типа. */ (name, i) => ({
          uid: `c-${i}`,
          name,
          category_type: config.params.category_type,
          description: null,
          money_plan: null,
        }),
      ),
    }
  else if (config.url === '/transactions/batch') {
    const { items } = JSON.parse(config.data) as { items: TransactionUpdateItem[] }
    if (params.has('conflict'))
      throw new AxiosError('Конфликт', 'ERR_BAD_REQUEST', config, undefined, {
        config,
        status: 409,
        statusText: 'Conflict',
        headers: {},
        data: {
          errors: [
            {
              index: 0,
              uid: items[0]!.uid,
              field: 'expected_version',
              message: 'Версия операции изменилась',
            },
          ],
        },
      })
    const content = items.map(
      /** Применяет изменения к записи стенда. */ (item) => {
        const row = records.find(/** Находит изменяемую запись. */ (r) => r.uid === item.uid)!
        if (item.changes.date)
          row.transaction_date = item.changes.date + row.transaction_date.slice(10)
        if (item.changes.money_sum !== undefined) row.money_sum = item.changes.money_sum
        if (item.changes.description !== undefined) row.description = item.changes.description
        if (item.changes.category_uid)
          row.category = {
            uid: item.changes.category_uid,
            name: names[Number(item.changes.category_uid.slice(2))]!,
          }
        row.version++
        return { ...row }
      },
    )
    data = { content }
  } else if (config.url === '/transactions/batch-delete') {
    const { items } = JSON.parse(config.data) as { items: TransactionVersionItem[] }
    data = {
      results: items.map(
        /** Удаляет запись либо возвращает тестовый конфликт. */ (item, index) => {
          if (params.has('partial') && index % 2)
            return {
              index,
              uid: item.uid,
              status: 409,
              code: 'FM-409204',
              message: 'Версия операции изменилась',
            }
          records = records.filter(
            /** Оставляет остальные операции. */ (row) => row.uid !== item.uid,
          )
          return { index, uid: item.uid, status: 204 }
        },
      ),
    }
  } else if (config.url === '/transactions') {
    const q = config.params
    const filtered = records
      .filter(
        /** Применяет серверные фильтры стенда. */ (r) =>
          r.transaction_type === q.transaction_type &&
          (!q.category_uid || r.category.uid === q.category_uid) &&
          (!q.after || r.transaction_date >= q.after) &&
          (!q.before || r.transaction_date <= q.before),
      )
      .sort(
        /** Сортирует по локальной дате. */ (a, b) =>
          q.sort === 'transaction_date'
            ? a.transaction_date.localeCompare(b.transaction_date)
            : b.transaction_date.localeCompare(a.transaction_date),
      )
    const skip = q.skip ?? 0,
      content = filtered.slice(skip, skip + q.limit)
    data = {
      total: filtered.length,
      content,
      next_skip: skip + content.length < filtered.length ? skip + content.length : null,
    }
  } else
    data = records.find(
      /** Читает отдельную запись для сверки. */ (row) => config.url === `/transactions/${row.uid}`,
    )
  return { config, status: 200, statusText: 'OK', headers: {}, data }
}
createApp({
  /** Показывает окно поверх фоновой страницы приложения. */ render: () =>
    h(TransactionListDialog, { type: 'outcome' }),
})
  .use(createPinia())
  .mount('#app')
