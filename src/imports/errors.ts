import type { ImportIssue } from '@/api/imports'

const messages: Record<string, string> = {
  'FM-400301': 'Не удалось прочитать запрос. Выберите файл заново.',
  'FM-401000': 'Сессия истекла. Войдите снова.',
  'FM-409202': 'Превышен лимит 100 000 операций. Ничего не сохранено.',
  'FM-409301': 'Категории изменились во время импорта. Проверьте файл. Ничего не сохранено.',
  'FM-413301': 'Файл должен быть не больше 5 МиБ. Ничего не сохранено.',
  'FM-413302': 'Превышен лимит 10 000 операций или объём содержимого Excel. Ничего не сохранено.',
  'FM-415301':
    'Формат файла не поддерживается. Используйте CSV или Excel (.xlsx). Ничего не сохранено.',
  'FM-422000': 'Не удалось принять файл. Выберите файл заново. Ничего не сохранено.',
  'FM-422301': 'Проверьте структуру файла. Ничего не сохранено.',
  'FM-422302': 'В файле нет операций. Ничего не сохранено.',
  'FM-422303': 'Исправьте ошибки в файле. Ничего не сохранено.',
  'FM-500301': 'Не удалось сохранить операции. Ничего не сохранено.',
}

/** Различает подтверждённые ошибки контракта и неизвестный результат сохранения. */
export function mapImportError(error: unknown) {
  const response = (
    error as {
      response?: {
        status?: number
        data?: { code?: string; errors?: ImportIssue[]; errors_truncated?: boolean }
      }
    }
  )?.response
  const data = response?.data
  const code = data?.code ?? ''
  const issues = Array.isArray(data?.errors) ? data.errors : []
  const known =
    code === 'FM-422301' &&
    issues.some(
      /** Проверяет причину ошибки кодировки, переданную сервером. */ (issue) =>
        issue.reason === 'invalid_encoding',
    )
      ? 'Сохраните файл в кодировке UTF-8. Ничего не сохранено.'
      : messages[code]
  const hasIssues = ['FM-422301', 'FM-422302', 'FM-422303'].includes(code)
  return {
    message:
      known ??
      (response?.status === 401
        ? 'Сессия истекла. Войдите снова.'
        : 'Результат импорта неизвестен. Проверьте список операций перед повторной загрузкой'),
    unknown: !known && response?.status !== 401,
    issues: hasIssues ? issues : [],
    truncated: hasIssues && data?.errors_truncated === true,
  }
}
