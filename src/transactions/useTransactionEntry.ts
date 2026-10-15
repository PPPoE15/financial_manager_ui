import { isAxiosError } from 'axios'
import { ref } from 'vue'
import { listCategories } from '@/api/categories'
import { createTransaction } from '@/api/transactions'
import type { TransactionType } from '@/types/budget'
import type { Category } from '@/types/category'

type Field = 'category' | 'amount' | 'description'
export interface EntryRow {
  key: number
  category: string
  amount: string
  description: string
  errors: Partial<Record<Field, string>>
  message: string
}
const pad = (value: number) => String(value).padStart(2, '0')
function today() {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
function validDate(value: string): boolean {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00`)
  return (
    !Number.isNaN(date.getTime()) &&
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` === value
  )
}
function touched(row: EntryRow) {
  return Boolean(row.category || row.amount || row.description)
}
function parseAmount(value: string) {
  const normalized = value.replace(/[ \u00a0\u202f]/g, '')
  return /^\d+$/.test(normalized) ? Number(normalized) : NaN
}
function errorMessage(error: unknown): string {
  if (isAxiosError<{ code?: string }>(error)) {
    switch (error.response?.data?.code) {
      case 'FM-400202':
        return 'Тип операции не совпадает с типом статьи. Выберите другую категорию.'
      case 'FM-400201':
        return 'Статья не найдена. Выберите другую категорию.'
      case 'FM-409202':
        return 'Достигнут лимит транзакций. Новые записи сохранить нельзя.'
    }
  }
  return 'Не удалось сохранить запись. Попробуйте ещё раз.'
}

export function useTransactionEntry(type: TransactionType) {
  let nextKey = 0
  const emptyRow = (): EntryRow => ({
    key: nextKey++,
    category: '',
    amount: '',
    description: '',
    errors: {},
    message: '',
  })
  const rows = ref<EntryRow[]>([emptyRow()])
  const categories = ref<Category[]>([])
  const date = ref(today())
  const dateError = ref('')
  const loading = ref(true)
  const loadFailed = ref(false)
  const saving = ref(false)

  async function load() {
    loading.value = true
    loadFailed.value = false
    try {
      categories.value = await listCategories(type)
    } catch {
      loadFailed.value = true
    } finally {
      loading.value = false
    }
  }

  function update(row: EntryRow, field: Field, value: string) {
    if (saving.value) return
    row[field] = value
    delete row.errors[field]
    row.message = ''
    if (touched(rows.value[rows.value.length - 1]!)) rows.value.push(emptyRow())
  }

  async function save(): Promise<{ saved: boolean; complete: boolean } | null> {
    if (saving.value || loading.value || loadFailed.value || !categories.value.length) return null
    const filled = rows.value.filter(touched)
    dateError.value = validDate(date.value) ? '' : 'Выберите дату с 2000 по 2099 год'
    for (const row of rows.value) {
      row.errors = {}
      row.message = ''
    }
    for (const row of filled) {
      if (!row.category || !categories.value.some((category) => category.uid === row.category))
        row.errors.category = 'Выберите категорию'
      const amount = parseAmount(row.amount)
      if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000_000)
        row.errors.amount = 'Введите целые рубли от 1 до 1 000 000 000'
      if (Array.from(row.description).length > 500)
        row.errors.description = 'Комментарий — не больше 500 символов'
      else if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(row.description))
        row.errors.description = 'Комментарий содержит недопустимые символы'
    }
    if (dateError.value || filled.some((row) => Object.keys(row.errors).length))
      return { saved: false, complete: false }
    saving.value = true
    const now = new Date()
    const transactionDate = `${date.value}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    let saved = false
    try {
      await Promise.all(
        filled.map(async (row) => {
          try {
            await createTransaction({
              transaction_date: transactionDate,
              category_uid: row.category,
              money_sum: parseAmount(row.amount),
              transaction_type: type,
              description: row.description || null,
            })
            saved = true
            rows.value = rows.value.filter((item) => item.key !== row.key)
          } catch (error) {
            row.message = errorMessage(error)
          }
        }),
      )
      return { saved, complete: !rows.value.some(touched) }
    } finally {
      saving.value = false
    }
  }
  return { rows, categories, date, dateError, loading, loadFailed, saving, load, update, save }
}
