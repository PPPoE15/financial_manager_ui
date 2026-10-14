import type { TransactionType } from '@/types/budget'

/** Статья (`Category` в contracts/transaction.openapi.yaml). */
export interface Category {
  uid: string
  name: string
  /** Плановая сумма за месяц в целых рублях; `null` — плана нет (не то же самое, что 0). */
  money_plan: number | null
  category_type: TransactionType
  description: string | null
}

/** Тело `POST /transaction/categories` (`CategoryCreate`). */
export interface CategoryCreate {
  name: string
  money_plan?: number | null
  category_type: TransactionType
  description?: string | null
}

/**
 * Тело `PATCH /transaction/categories/{uid}` (`CategoryUpdate`): только изменённые поля.
 * Тип статьи окно не меняет (колонки фиксированы), поэтому `category_type` здесь нет.
 */
export interface CategoryUpdate {
  name?: string
  money_plan?: number | null
  description?: string | null
}

/** Ответ `GET /transaction/categories` (`CategoryList`). */
export interface CategoryList {
  total: number
  content: Category[]
}
