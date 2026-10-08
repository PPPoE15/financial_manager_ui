import { http } from '@/api/client'
import type { BudgetStructure, TransactionType } from '@/types/budget'

/** `GET /transaction/budget-structure` — факт по статьям выбранного типа за 12 месяцев года. */
export async function getBudgetStructure(
  year: number,
  categoryType: TransactionType,
): Promise<BudgetStructure> {
  const { data } = await http.get<BudgetStructure>('/budget-structure', {
    params: { year, category_type: categoryType },
  })
  return data
}
