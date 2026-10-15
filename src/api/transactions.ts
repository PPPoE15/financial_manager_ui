import { http } from '@/api/client'
import type { TransactionType } from '@/types/budget'
import type { Transaction, TransactionList } from '@/types/transaction'

/** Пять последних записей типа; порядок по дате (и uid при равенстве) задаёт сервер. */
export async function listTransactions(type: TransactionType): Promise<Transaction[]> {
  const { data } = await http.get<TransactionList>('/transactions', {
    params: { transaction_type: type, limit: 5, sort: '-transaction_date' },
  })
  return data.content
}
