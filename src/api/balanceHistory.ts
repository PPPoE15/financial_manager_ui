import { http } from '@/api/client'
import type { BalanceHistory } from '@/types/balanceHistory'

/** Загружает готовые дневные остатки за включительный диапазон. */
export async function getBalanceHistory(dateFrom: string, dateTo: string): Promise<BalanceHistory> {
  const { data } = await http.get<BalanceHistory>('/balance-history', {
    params: { date_from: dateFrom, date_to: dateTo },
  })
  return data
}
