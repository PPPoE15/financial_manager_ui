import type { TransactionType } from '@/types/budget'

export interface Transaction {
  version: number
  uid: string
  transaction_date: string
  category: { uid: string; name: string }
  money_sum: number
  transaction_type: TransactionType
  description: string | null
}

export interface TransactionList {
  next_skip: number | null
  total: number
  content: Transaction[]
}

export interface TransactionCreate {
  transaction_date: string
  category_uid: string
  money_sum: number
  transaction_type: TransactionType
  description: string | null
}

export interface TransactionFilters {
  transaction_type: TransactionType
  category_uid?: string
  after?: string
  before?: string
  sort: '-transaction_date' | 'transaction_date'
}
export interface TransactionPageParams extends TransactionFilters {
  skip: number
  limit: number
}
export interface TransactionBatchChanges {
  date?: string
  money_sum?: number
  category_uid?: string
  description?: string | null
}
export interface TransactionVersionItem {
  uid: string
  expected_version: number
}
export interface TransactionUpdateItem extends TransactionVersionItem {
  changes: TransactionBatchChanges
}
export type TransactionDeleteItemResult = { index: number; uid: string } & (
  | { status: 204 }
  | { status: 404 | 409; code: string; message: string }
)
