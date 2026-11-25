/** Дневной остаток в целых рублях; null означает неизвестный остаток. */
export interface BalanceHistoryPoint {
  date: string
  balance: number | null
}
/** Ответ GET /transaction/balance-history с границами восстановленной истории FM-155. */
export interface BalanceHistory {
  date_from: string
  date_to: string
  history_start_date: string
  starting_balance_date: string
  currency: 'RUB'
  unit: 'rubles'
  timezone: 'Europe/Moscow'
  points: BalanceHistoryPoint[]
}
