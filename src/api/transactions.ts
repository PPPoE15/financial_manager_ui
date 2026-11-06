import { http } from '@/api/client'
import type { TransactionType } from '@/types/budget'
import type { Transaction, TransactionCreate, TransactionList } from '@/types/transaction'

/** Создаёт одну запись; ошибки передаются строке окна ввода. */
export async function createTransaction(body: TransactionCreate): Promise<Transaction> {
  const { data } = await http.post<Transaction>('/transactions', body)
  return data
}

/** Пять последних записей типа; порядок по дате (и uid при равенстве) задаёт сервер. */
export async function listTransactions(type: TransactionType): Promise<Transaction[]> {
  const { data } = await http.get<TransactionList>('/transactions', {
    params: { transaction_type: type, limit: 5, sort: '-transaction_date' },
  })
  return data.content
}

/** Загружает страницу операций вместе с количеством и смещением следующей страницы. */
export async function fetchTransactions(
  params: import('@/types/transaction').TransactionPageParams,
  signal?: AbortSignal,
): Promise<TransactionList> {
  return (await http.get<TransactionList>('/transactions', { params, signal })).data
}
/** Читает актуальную запись для открытия и явной сверки конфликта. */
export async function getTransaction(uid: string): Promise<Transaction> {
  return (await http.get<Transaction>(`/transactions/${encodeURIComponent(uid)}`)).data
}
/** Сохраняет весь набор правок атомарно, без автоматического повтора. */
export async function saveTransactions(
  items: import('@/types/transaction').TransactionUpdateItem[],
): Promise<Transaction[]> {
  return (await http.patch<{ content: Transaction[] }>('/transactions/batch', { items })).data
    .content
}
/** Возвращает отдельный результат удаления каждой выбранной операции. */
export async function deleteTransactions(
  items: import('@/types/transaction').TransactionVersionItem[],
): Promise<import('@/types/transaction').TransactionDeleteItemResult[]> {
  return (
    await http.post<{ results: import('@/types/transaction').TransactionDeleteItemResult[] }>(
      '/transactions/batch-delete',
      { items },
    )
  ).data.results
}
