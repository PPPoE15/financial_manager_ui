export interface CreateTransaction {
  transaction_date: string
  category: string
  money_sum: number
  transaction_type: string
  description: string
}

export type TransactionType = 'income' | 'outcome'
