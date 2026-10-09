import { ref, watch } from 'vue'

import { getBudgetStructure } from '@/api/budget'
import type { BudgetStructure, TransactionType } from '@/types/budget'

/** Границы `year` в `GET /budget-structure` по контракту. */
export const MIN_YEAR = 2000
export const MAX_YEAR = 2099

function currentYear(): number {
  return Math.min(MAX_YEAR, Math.max(MIN_YEAR, new Date().getFullYear()))
}

/**
 * Таблица «Структура бюджета» за выбранные год и тип статей: по умолчанию расходы текущего года.
 * Смена `year` или `categoryType` перезапрашивает таблицу; ответ (или ошибка) на устаревший запрос
 * отбрасывается, чтобы не перетереть данные актуального.
 */
export function useBudgetStructure() {
  const year = ref(currentYear())
  const categoryType = ref<TransactionType>('outcome')
  const data = ref<BudgetStructure | null>(null)
  const loading = ref(false)
  const failed = ref(false)

  // TODO(FM-28): устаревшие запросы не отменяются, их результат только отбрасывается: быстрый перебор лет
  // шлёт запрос на каждый шаг. Отменять через AbortController (`signal` в axios) / onWatcherCleanup —
  // заодно уйдут три проверки счётчика в try/catch/finally.
  let latestRequest = 0

  async function load(): Promise<void> {
    const request = ++latestRequest
    loading.value = true
    failed.value = false
    try {
      const result = await getBudgetStructure(year.value, categoryType.value)
      if (request === latestRequest) data.value = result
    } catch {
      if (request === latestRequest) {
        data.value = null
        failed.value = true
      }
    } finally {
      if (request === latestRequest) loading.value = false
    }
  }

  watch([year, categoryType], load, { immediate: true })

  return { year, categoryType, data, loading, failed, reload: load }
}
