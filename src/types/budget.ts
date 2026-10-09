/** Тип статьи и транзакции: `income` — доход, `outcome` — расход. */
export type TransactionType = 'income' | 'outcome'

/** Ссылка на статью в отчётах. */
export interface CategoryRef {
  uid: string
  name: string
}

// NOTE(FM-28): агрегаты (`fact`, `average`, итоги) в контракте int64 (`MoneyTotal`), а number точен до 2^53 —
// для рублёвых сумм недостижимо. Скринридер в итоговой строке при `money_plan: null` читает «план не задан»,
// хотя точнее «ни у одной статьи план не задан».
/** Факт месяца: сумма транзакций; `null` — месяц ещё не наступил. */
export interface MonthFact {
  month: number
  fact: number | null
}

/** Строка таблицы: статья, её план (`null` — плана нет), среднее (`null` — нет завершённых месяцев). */
export interface BudgetStructureRow {
  category: CategoryRef
  money_plan: number | null
  average: number | null
  months: MonthFact[]
}

/** Итоговая строка «сумма». */
export interface BudgetStructureTotal {
  money_plan: number | null
  average: number | null
  months: MonthFact[]
}

/** Ответ `GET /transaction/budget-structure` (см. `contracts/transaction.openapi.yaml`). */
export interface BudgetStructure {
  year: number
  category_type: TransactionType
  rows: BudgetStructureRow[]
  total: BudgetStructureTotal
}
