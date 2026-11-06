import type { Transaction } from '@/types/transaction'
/** Создаёт полную операцию для сценариев редактора. */
export function transaction(uid = 'one', changes: Partial<Transaction> = {}): Transaction {
  return { uid, version: 3, transaction_date: '2026-11-05T14:30:12.123456', category: { uid: 'food', name: 'Продукты' }, money_sum: 2650, transaction_type: 'outcome', description: 'Покупки', ...changes }
}
/** Позволяет управлять порядком сетевых ответов в тесте. */
export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>(/** Сохраняет обработчики завершения запроса. */ (yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
