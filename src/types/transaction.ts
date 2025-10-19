export interface CreateTransaction {
  transactionDate: string;
  category: string;
  moneySum: number;
  transactionType: 'income' | 'outcome';
  description: string;
}
