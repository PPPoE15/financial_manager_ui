import type { BudgetStructure, MonthFact, TransactionType } from '@/types/budget'

/** 12 месяцев: заданные факты подряд с января, остальные — `null` (ещё не наступили). */
export function months(...facts: (number | null)[]): MonthFact[] {
  return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, fact: facts[i] ?? null }))
}

/** Таблица как в примере контракта: март текущего года, у «подарков» нет плана. */
export function budgetStructure(
  overrides: Partial<BudgetStructure> = {},
  categoryType: TransactionType = 'outcome',
): BudgetStructure {
  return {
    year: 2026,
    category_type: categoryType,
    rows: [
      {
        category: { uid: '3a6c3f0e-8f1b-4b8e-9f43-2a1d6b2c9e10', name: 'еда вне дома' },
        money_plan: 5000,
        average: 5000,
        months: months(5000, 5000, 9436),
      },
      {
        category: { uid: '9b1d1c55-2c0a-4d77-8f3e-6a9e0b7d4c21', name: 'подарки' },
        money_plan: null,
        average: 0,
        months: months(0, 0, 0),
      },
    ],
    total: { money_plan: 5000, average: 5000, months: months(5000, 5000, 9436) },
    ...overrides,
  }
}
