import type { PlannedOperation } from '@/types/plannedOperation'

export interface PlanDraft {
  date: string
  amount: string
  category: string
  description: string
}
export type PlanErrors = Partial<Record<keyof PlanDraft, string>>
/** Отвергает недопустимый ввод целиком, включая вставку отрицательной суммы. */
export function acceptAmount(previous: string, value: string): string {
  return /^[\d\s]*$/.test(value) ? value.replace(/\s/g, '') : previous
}
/** Копирует исходные значения плана, не меняя даже прошедшую дату. */
export function draftFromPlan(
  plan: Pick<PlannedOperation, 'planned_date' | 'money_sum' | 'category' | 'description'>,
): PlanDraft {
  return {
    date: plan.planned_date,
    amount: String(plan.money_sum),
    category: plan.category.uid,
    description: plan.description ?? '',
  }
}
/** Проверяет поля перед отправкой; фактическая дата может быть прошедшей. */
export function validateDraft(draft: PlanDraft, today: string, actual = false): PlanErrors {
  const errors: PlanErrors = {}
  const parsed = new Date(`${draft.date}T00:00:00Z`)
  if (
    !/^20\d\d-\d\d-\d\d$/.test(draft.date) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== draft.date
  )
    errors.date = 'Укажите корректную дату'
  else if (!actual && draft.date < today) errors.date = 'Выберите сегодня или будущую дату'
  if (!/^\d+$/.test(draft.amount) || Number(draft.amount) < 1 || Number(draft.amount) > 1000000000)
    errors.amount = 'Укажите корректную сумму'
  if (!draft.category) errors.category = 'Выберите категорию'
  if ([...draft.description].length > 500) errors.description = 'Не более 500 символов'
  return errors
}
/** Форматирует календарную дату без смещения часового пояса браузера. */
export function formatPlanDate(date: string): string {
  return date.slice(0, 10).split('-').reverse().join('.')
}
