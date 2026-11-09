import type { EditorField, FieldErrors } from './editorModel'
export interface RowApiError {
  index?: number
  uid?: string
  field?: string | null
  message?: string
}
/** Извлекает контрактную ошибку независимо от способа отклонения сетевого запроса. */
export function readEditorError(error: unknown): {
  status: number
  errors: RowApiError[]
  message: string
} {
  const response = (
    error as { response?: { status?: number; data?: { errors?: RowApiError[]; message?: string } } }
  )?.response
  const status = response?.status ?? 0
  const messages: Record<number, string> = {
    400: 'Проверьте категорию операции.',
    401: 'Сессия завершена. Войдите снова.',
    404: 'Операция недоступна. Сверьте данные.',
    409: 'Операция изменена. Сверьте ваши правки с актуальными данными.',
    413: 'Запрос слишком большой. Уменьшите число изменений.',
    422: 'Проверьте поля операций.',
  }
  return {
    status,
    errors: Array.isArray(response?.data?.errors) ? response.data.errors : [],
    message: messages[status] ?? 'Результат запроса неизвестен. Сверьте данные перед повтором.',
  }
}
/** Переводит поле контрактной ошибки в поле редактора. */
export function errorField(field?: string | null): keyof FieldErrors {
  const name = field?.split('.').pop()
  if (name === 'money_sum') return 'amount'
  if (name && ['date', 'category_uid', 'description'].includes(name)) return name as EditorField
  return 'row'
}
