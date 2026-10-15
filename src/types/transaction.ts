import type { TransactionType } from '@/types/budget'

export interface Transaction {
  uid: string
  transaction_date: string
  category: { uid: string; name: string }
  money_sum: number
  transaction_type: TransactionType
  description: string | null
}

export interface TransactionList {
  total: number
  content: Transaction[]
}
