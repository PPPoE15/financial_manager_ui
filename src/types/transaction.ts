export interface CreateTransaction {
  transaction_date: string;
  category: string;
  money_sum: number;
  transaction_type: 'income' | 'outcome';
  description: string;
}
