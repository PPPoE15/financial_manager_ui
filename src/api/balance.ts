import { http } from '@/api/client'
import type { StartingBalance, StartingBalanceCreate } from '@/types/balance'

/** `GET /transaction/starting-balance` — стартовый остаток; 404 (`FM-404201`) — ещё не задан. */
export async function getStartingBalance(): Promise<StartingBalance> {
  const { data } = await http.get<StartingBalance>('/starting-balance')
  return data
}

/** `POST /transaction/starting-balance` — задаёт остаток один раз; повтор — 409 (`FM-409201`). */
export async function createStartingBalance(body: StartingBalanceCreate): Promise<StartingBalance> {
  const { data } = await http.post<StartingBalance>('/starting-balance', body)
  return data
}
