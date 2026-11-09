/** Дневной остаток в целых рублях; null означает неизвестный остаток. */
export interface BalanceHistoryPoint {
  date: string
  balance: number | null
}
/** Ответ GET /transaction/balance-history по контракту FM-87. */
export interface BalanceHistory {
  date_from: string
  date_to: string
  currency: 'RUB'
  unit: 'rubles'
  timezone: 'Europe/Moscow'
  points: BalanceHistoryPoint[]
}
