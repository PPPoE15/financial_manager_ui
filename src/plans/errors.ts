import type { PlanErrors } from './model'
/** Разбирает стандартную ошибку API и связывает её с полями формы. */
export function planError(error: unknown) {
  const response = (
    error as {
      response?: {
        status: number
        data?: { code?: string; validation?: { field: string; message: string }[] }
      }
    }
  )?.response
  const status = response?.status ?? 0
  const code = response?.data?.code
  const fields: PlanErrors = {}
  const names: Record<string, keyof PlanErrors> = {
    planned_date: 'date',
    transaction_date: 'date',
    money_sum: 'amount',
    category_uid: 'category',
    description: 'description',
  }
  for (const item of response?.data?.validation ?? []) {
    const name = names[item.field.split('.').pop() ?? '']
    if (name) fields[name] = item.message
  }
  if (status === 400) fields.category = 'Категория недоступна. Выберите актуальную категорию.'
  const unknown = status === 0 || status >= 500
  const message =
    code === 'FM-409404'
      ? 'Достигнут лимит планов. Удалите ненужные планы.'
      : code === 'FM-409202'
        ? 'Достигнут лимит фактических операций.'
        : ((
            {
              400: 'Проверьте категорию.',
              401: 'Сессия завершена. Войдите снова.',
              404: 'План недоступен. Обновите список.',
              409: 'План изменён. Сверьте актуальные данные с черновиком.',
              413: 'Слишком большой запрос.',
              422: 'Проверьте поля операции.',
            } as Record<number, string>
          )[status] ?? 'Результат запроса неизвестен. Проверьте данные перед повтором.')
  return { status, code, fields, unknown, message }
}
