import { isAxiosError } from 'axios'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { getBalanceHistory } from '@/api/balanceHistory'
import { defaultRange, moscowToday, validateRange } from './dates'
import type { BalanceHistoryPoint } from '@/types/balanceHistory'

/** Загружает отчёт при смене диапазона и защищает состояние от устаревших ответов. */
export function useBalanceHistory() {
  const initial = defaultRange()
  const from = ref(initial.from)
  const to = ref(initial.to)
  const points = ref<BalanceHistoryPoint[]>([])
  const loading = ref(false)
  const error = ref('')
  const validation = ref('')
  const needsBalance = ref(false)
  const today = ref(moscowToday())
  const unknown = computed(
    /** Отличает неизвестный остаток от известного нуля. */ () =>
      points.value.length > 0 &&
      points.value.every(
        /** Проверяет отсутствие известного значения. */ (point) => point.balance === null,
      ),
  )
  let generation = 0

  /** Повторяет запрос только для допустимого диапазона и текущего поколения. */
  async function reload(): Promise<void> {
    const current = ++generation
    today.value = moscowToday()
    validation.value = validateRange(from.value, to.value, today.value)
    error.value = ''
    needsBalance.value = false
    points.value = []
    loading.value = false
    if (validation.value) return
    loading.value = true
    try {
      const data = await getBalanceHistory(from.value, to.value)
      if (current === generation) points.value = data.points
    } catch (cause) {
      if (current !== generation) return
      if (
        isAxiosError(cause) &&
        cause.response?.status === 409 &&
        cause.response.data?.code === 'FM-409203'
      ) {
        needsBalance.value = true
      } else if (isAxiosError(cause) && cause.response?.status === 422) {
        error.value = 'Проверьте даты: диапазон от 1 до 366 дней, не позже сегодня по Москве'
      } else {
        error.value = 'Не удалось загрузить динамику финансов. Попробуйте ещё раз'
      }
    } finally {
      if (current === generation) loading.value = false
    }
  }

  watch([from, to], reload, { immediate: true, flush: 'sync' })
  onScopeDispose(
    /** Запрещает завершённым запросам обновлять закрытую карточку. */ () => {
      generation++
    },
  )
  return { from, to, points, loading, error, validation, needsBalance, today, unknown, reload }
}
