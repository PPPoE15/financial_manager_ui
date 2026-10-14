import { isAxiosError } from 'axios'
import { reactive, ref, watch, type Ref } from 'vue'

import { createCategory, listCategories, MAX_CATEGORIES } from '@/api/categories'
import { GENERIC_ERROR, NETWORK_ERROR, SERVER_ERROR } from '@/auth/errors'
import { parsePlan, validateCategoryName, validateDescription } from '@/categories/validation'
import type { TransactionType } from '@/types/budget'
import type { Category, CategoryCreate } from '@/types/category'

export type NewRowField = 'name' | 'plan' | 'description'

/** Строка для новой статьи в том виде, как её ввёл пользователь, и её ошибки. */
export interface NewRow {
  key: number
  name: string
  plan: string
  description: string
  errors: Partial<Record<NewRowField, string>>
  /** Ошибка строки целиком (лимит статей). */
  message: string | null
}

/** Колонка окна: статьи одного типа и строки для новых. */
export interface EditorColumn {
  type: TransactionType
  categories: Category[]
  rows: NewRow[]
}

export const DUPLICATE_ERROR = 'Такая статья уже есть'
export const LIMIT_ERROR = `Достигнут лимит в ${MAX_CATEGORIES} статей`

const DUPLICATE_CODE = 'FM-409101'
const LIMIT_CODE = 'FM-409103'

// Сообщения бэкенда в 422 — от pydantic на английском, поэтому у поля показываем свои
const FIELD_FORMAT_ERRORS: Record<NewRowField, string> = {
  name: 'Проверьте название: от 1 до 64 символов, без служебных символов',
  plan: 'Проверьте план: целое число от 0 до 1 000 000 000 ₽',
  description: 'Проверьте комментарий: не длиннее 500 символов',
}

// Поля тела запроса → поля строки
const REQUEST_FIELDS: Record<string, NewRowField> = {
  name: 'name',
  money_plan: 'plan',
  description: 'description',
}

let nextKey = 0

function emptyRow(): NewRow {
  nextKey += 1
  return { key: nextKey, name: '', plan: '', description: '', errors: {}, message: null }
}

// TODO(FM-42): строка из одних пробелов считается заполненной — появляется ещё одна пустая, а «Сохранить»
// показывает «Введите название» у строки, которая выглядит пустой. Сравнивать после trim().
function isBlank(row: NewRow): boolean {
  return !row.name && !row.plan && !row.description
}

function emptyColumn(type: TransactionType): EditorColumn {
  return { type, categories: [], rows: [emptyRow()] }
}

interface ProblemResponse {
  code?: string
  validation?: { field?: string }[]
}

// TODO(FM-42): разбор «нет ответа / 5xx / 422 по полям» и `ProblemResponse` повторяют mapAuthError
// из auth/errors.ts (и mapSaveError из firstStep) — вынести общий разбор ошибок API.
/** Разложить ошибку `POST /categories` по строке; вернуть общее сообщение окна, если оно нужно. */
function applySaveError(row: NewRow, error: unknown): string | null {
  if (!isAxiosError(error)) return GENERIC_ERROR
  if (!error.response) return NETWORK_ERROR
  const { status } = error.response
  const data = (error.response.data ?? {}) as ProblemResponse
  if (status >= 500) return SERVER_ERROR
  if (status === 409 && data.code === DUPLICATE_CODE) {
    row.errors = { name: DUPLICATE_ERROR }
    return null
  }
  if (status === 409 && data.code === LIMIT_CODE) {
    row.message = LIMIT_ERROR
    return null
  }
  if (status === 422) {
    const fields = (data.validation ?? [])
      // TODO(FM-42): без проверки own-property, как `isAuthField` в auth/errors.ts: `field: "constructor"`
      // даст мусорный ключ и ошибка не покажется нигде. Клиент шлёт только известные поля — маловероятно.
      .map((item) => REQUEST_FIELDS[item.field ?? ''])
      .filter((field): field is NewRowField => field !== undefined)
    if (fields.length) {
      row.errors = Object.fromEntries(fields.map((field) => [field, FIELD_FORMAT_ERRORS[field]]))
      return null
    }
  }
  return GENERIC_ERROR
}

/** Проверить заполненную строку; вернуть тело запроса или `null`, если есть ошибки (они — в строке). */
function validateRow(
  row: NewRow,
  type: TransactionType,
  takenNames: Set<string>,
): CategoryCreate | null {
  const name = validateCategoryName(row.name)
  const plan = parsePlan(row.plan)
  const description = validateDescription(row.description)
  const duplicate = name.value !== undefined && takenNames.has(name.value)
  row.errors = {
    ...(name.error && { name: name.error }),
    ...(duplicate && { name: DUPLICATE_ERROR }),
    ...(plan.error && { plan: plan.error }),
    ...(description.error && { description: description.error }),
  }
  if (name.value !== undefined) takenNames.add(name.value)
  if (Object.keys(row.errors).length) return null
  return {
    name: name.value!,
    money_plan: plan.value!,
    category_type: type,
    description: description.value!,
  }
}

export interface SaveResult {
  /** Сколько статей создано. */
  saved: number
  /** Все заполненные строки сохранены (или сохранять было нечего). */
  complete: boolean
}

export interface CategoryEditor {
  columns: Record<TransactionType, EditorColumn>
  loading: Ref<boolean>
  loadFailed: Ref<boolean>
  message: Ref<string | null>
  saving: Ref<boolean>
  load: () => Promise<void>
  save: () => Promise<SaveResult | null>
  /** Изменить поле строки для новой статьи (ввод пользователя). */
  updateRow: (row: NewRow, field: NewRowField, value: string) => void
}

/**
 * Окно «Редактирование категорий»: статьи расходов и доходов (только для чтения, изменение — FM-4)
 * и строки для новых статей. «Сохранить» создаёт статью на каждую заполненную строку отдельным запросом
 * (пакетного эндпоинта нет): сохранённые строки уходят в список, у несохранённых остаётся ошибка.
 */
export function useCategoryEditor(): CategoryEditor {
  const columns = reactive<Record<TransactionType, EditorColumn>>({
    outcome: emptyColumn('outcome'),
    income: emptyColumn('income'),
  })
  const loading = ref(false)
  const loadFailed = ref(false)
  const message = ref<string | null>(null)
  const saving = ref(false)

  // Пустая строка всегда последняя: как только в неё начали вводить, под ней появляется следующая
  // TODO(FM-42): лишние пустые строки не убираются — ввести символ и стереть его оставляет две пустые внизу.
  for (const column of Object.values(columns)) {
    watch(
      () => column.rows.map(isBlank),
      (blank) => {
        if (!blank.length || !blank[blank.length - 1]) column.rows.push(emptyRow())
      },
    )
  }

  async function load(): Promise<void> {
    loading.value = true
    loadFailed.value = false
    try {
      const [outcome, income] = await Promise.all([
        listCategories('outcome'),
        listCategories('income'),
      ])
      columns.outcome.categories = outcome
      columns.income.categories = income
    } catch {
      loadFailed.value = true
    } finally {
      loading.value = false
    }
  }

  async function saveRow(
    column: EditorColumn,
    row: NewRow,
    body: CategoryCreate,
  ): Promise<boolean> {
    try {
      const created = await createCategory(body)
      // NOTE(FM-42): созданная статья добавляется в конец в порядке ответов, а не по названию, как в
      // GET /categories; порядок восстанавливается при следующем открытии окна.
      column.categories.push(created)
      column.rows.splice(column.rows.indexOf(row), 1)
      return true
    } catch (error) {
      const windowMessage = applySaveError(row, error)
      if (windowMessage) message.value = windowMessage
      return false
    }
  }

  async function save(): Promise<SaveResult | null> {
    // Повторное нажатие (двойной клик, Enter во время запроса) не уходит вторым запросом
    if (saving.value) return null
    message.value = null

    const requests: { column: EditorColumn; row: NewRow; body: CategoryCreate }[] = []
    let invalid = false
    for (const column of Object.values(columns)) {
      const takenNames = new Set(column.categories.map((category) => category.name))
      for (const row of column.rows) {
        row.message = null
        row.errors = {}
        if (isBlank(row)) continue
        const body = validateRow(row, column.type, takenNames)
        if (body) requests.push({ column, row, body })
        else invalid = true
      }
    }
    if (invalid) return null

    saving.value = true
    try {
      const results = await Promise.all(
        requests.map(({ column, row, body }) => saveRow(column, row, body)),
      )
      const saved = results.filter(Boolean).length
      return { saved, complete: saved === results.length }
    } finally {
      saving.value = false
    }
  }

  // TODO(FM-42): ошибка поля (в том числе 409/422 от сервера) остаётся до следующего «Сохранить», хотя поле
  // уже исправлено — сбрасывать ошибку поля (и ошибку строки) при вводе.
  function updateRow(row: NewRow, field: NewRowField, value: string): void {
    row[field] = value
  }

  return { columns, loading, loadFailed, message, saving, load, save, updateRow }
}
