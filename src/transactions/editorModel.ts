import type { Transaction, TransactionBatchChanges } from '@/types/transaction'

export interface EditorValues {
  date: string
  amount: string
  category_uid: string
  description: string
}
export type EditorField = keyof EditorValues
export type FieldErrors = Partial<Record<EditorField | 'row', string>>
export interface TransactionDraft {
  original: Transaction
  values: EditorValues
  errors: FieldErrors
}

/** Создаёт отдельную копию сохранённых данных и редактируемых полей. */
export function createDraft(transaction: Transaction): TransactionDraft {
  return {
    original: { ...transaction, category: { ...transaction.category } },
    values: {
      date: transaction.transaction_date.slice(0, 10),
      amount: String(transaction.money_sum),
      category_uid: transaction.category.uid,
      description: transaction.description ?? '',
    },
    errors: {},
  }
}
/** Разбирает целые рубли с пробелами без экспоненты и округления. */
export function parseEditorAmount(value: string): number {
  const normalized = value.replace(/[\s\u00a0\u202f]/g, '')
  return /^\d+$/.test(normalized) ? Number(normalized) : NaN
}
/** Проверяет существующий календарный день в контрактном диапазоне без преобразования зоны. */
export function validEditorDate(value: string): boolean {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00`)
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === Number(value.slice(0, 4)) &&
    date.getMonth() + 1 === Number(value.slice(5, 7)) &&
    date.getDate() === Number(value.slice(8, 10))
  )
}
/** Проверяет поля до формирования пакета, сохраняя ошибочный ввод. */
export function validateDraft(draft: TransactionDraft): FieldErrors {
  const errors: FieldErrors = {}
  const amount = parseEditorAmount(draft.values.amount)
  if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000_000)
    errors.amount = 'Введите целые рубли от 1 до 1 000 000 000'
  if (!validEditorDate(draft.values.date)) errors.date = 'Выберите дату с 2000 по 2099 год'
  if (!draft.values.category_uid) errors.category_uid = 'Выберите категорию'
  if (Array.from(draft.values.description).length > 500)
    errors.description = 'Комментарий — не больше 500 символов'
  else if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(draft.values.description))
    errors.description = 'Комментарий содержит недопустимые символы'
  return errors
}
/** Выделяет только изменённые поля; дату-время и базовую версию не переписывает. */
export function buildChanges(draft: TransactionDraft): TransactionBatchChanges {
  const { original, values } = draft
  const changes: TransactionBatchChanges = {}
  if (values.date !== original.transaction_date.slice(0, 10)) changes.date = values.date
  const amount = parseEditorAmount(values.amount)
  if (amount !== original.money_sum) changes.money_sum = amount
  if (values.category_uid !== original.category.uid) changes.category_uid = values.category_uid
  if ((values.description || null) !== original.description)
    changes.description = values.description || null
  return changes
}
