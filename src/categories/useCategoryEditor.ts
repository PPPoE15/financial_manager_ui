import { isAxiosError } from 'axios'
import { reactive, ref, watch, type Ref } from 'vue'

import { createCategory, listCategories, MAX_CATEGORIES, updateCategory } from '@/api/categories'
import { GENERIC_ERROR, NETWORK_ERROR, SERVER_ERROR } from '@/auth/errors'
import { parsePlan, validateCategoryName, validateDescription } from '@/categories/validation'
import type { TransactionType } from '@/types/budget'
import type { Category, CategoryCreate, CategoryUpdate } from '@/types/category'
import { formatMoney } from '@/utils/money'

export type RowField = 'name' | 'plan' | 'description'

/** Строка окна в том виде, как её ввёл пользователь, и её ошибки. */
export interface EditorRow {
  key: number
  name: string
  plan: string
  description: string
  errors: Partial<Record<RowField, string>>
  /** Ошибка строки целиком (лимит статей, статья удалена). */
  message: string | null
}

/** Строка существующей статьи: поля для правки и статья, как она сохранена на сервере. */
export interface CategoryRow extends EditorRow {
  category: Category
}

/** Колонка окна: существующие статьи одного типа и строки для новых. */
export interface EditorColumn {
  type: TransactionType
  categories: CategoryRow[]
  rows: EditorRow[]
}

export const DUPLICATE_ERROR = 'Такая статья уже есть'
export const LIMIT_ERROR = `Достигнут лимит в ${MAX_CATEGORIES} статей`
export const NOT_FOUND_ERROR = 'Статья удалена. Закройте окно и откройте его снова'

const DUPLICATE_CODE = 'FM-409101'
const LIMIT_CODE = 'FM-409103'

// Сообщения бэкенда в 422 — от pydantic на английском, поэтому у поля показываем свои
const FIELD_FORMAT_ERRORS: Record<RowField, string> = {
  name: 'Проверьте название: от 1 до 64 символов, без служебных символов',
  plan: 'Проверьте план: целое число от 0 до 1 000 000 000 ₽',
  description: 'Проверьте комментарий: не длиннее 500 символов',
}

// Поля тела запроса → поля строки
const REQUEST_FIELDS: Record<string, RowField> = {
  name: 'name',
  money_plan: 'plan',
  description: 'description',
}

let nextKey = 0

function emptyRow(): EditorRow {
  nextKey += 1
  return { key: nextKey, name: '', plan: '', description: '', errors: {}, message: null }
}

/** Значения полей статьи: план — с разделителями разрядов, как в макете («4 990»), без знака ₽. */
function fieldValues(category: Category): Pick<EditorRow, RowField> {
  return {
    name: category.name,
    plan:
      category.money_plan === null
        ? ''
        : formatMoney(category.money_plan)
            .replace(/\s₽$/, '')
            .replace(/\u00a0/g, ' '),
    description: category.description ?? '',
  }
}

function categoryRow(category: Category): CategoryRow {
  nextKey += 1
  return { key: nextKey, ...fieldValues(category), category, errors: {}, message: null }
}

/** Поля строки не трогали (или вернули как было) — проверять и отправлять нечего. */
function isUntouched(row: CategoryRow): boolean {
  const initial = fieldValues(row.category)
  return (['name', 'plan', 'description'] as const).every((field) => row[field] === initial[field])
}

// TODO(FM-42): строка из одних пробелов считается заполненной — появляется ещё одна пустая, а «Сохранить»
// показывает «Введите название» у строки, которая выглядит пустой. Сравнивать после trim().
function isBlank(row: EditorRow): boolean {
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
/** Разложить ошибку `POST`/`PATCH /categories` по строке; вернуть общее сообщение окна, если оно нужно. */
function applySaveError(row: EditorRow, error: unknown): string | null {
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
  // PATCH: статью удалили (в другой вкладке) после открытия окна
  if (status === 404) {
    row.message = NOT_FOUND_ERROR
    return null
  }
  if (status === 422) {
    const fields = (data.validation ?? [])
      // TODO(FM-42): без проверки own-property, как `isAuthField` в auth/errors.ts: `field: "constructor"`
      // даст мусорный ключ и ошибка не покажется нигде. Клиент шлёт только известные поля — маловероятно.
      .map((item) => REQUEST_FIELDS[item.field ?? ''])
      .filter((field): field is RowField => field !== undefined)
    if (fields.length) {
      row.errors = Object.fromEntries(fields.map((field) => [field, FIELD_FORMAT_ERRORS[field]]))
      return null
    }
  }
  return GENERIC_ERROR
}

type RowValues = Required<Pick<CategoryCreate, 'name' | 'money_plan' | 'description'>>

/**
 * Проверить строку (правила одни для новых и существующих статей); вернуть значения или `null`, если есть
 * ошибки (они — в строке). Название, уже занятое в колонке (`takenNames`), — дубликат; своё добавляется туда.
 */
function validateRow(row: EditorRow, takenNames: Set<string>): RowValues | null {
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
  return { name: name.value!, money_plan: plan.value!, description: description.value! }
}

/** Тело PATCH: только поля, отличающиеся от сохранённой статьи (очищенные — `null`). */
function changedFields(category: Category, values: RowValues): CategoryUpdate {
  return {
    ...(values.name !== category.name && { name: values.name }),
    ...(values.money_plan !== category.money_plan && { money_plan: values.money_plan }),
    ...(values.description !== category.description && { description: values.description }),
  }
}

/** Запрос «Сохранить»: создание статьи из новой строки или изменение существующей. */
type SaveRequest =
  | { kind: 'create'; column: EditorColumn; row: EditorRow; body: CategoryCreate }
  | { kind: 'update'; row: CategoryRow; body: CategoryUpdate }

export interface SaveResult {
  /** Сколько статей создано и изменено. */
  saved: number
  /** Все заполненные и изменённые строки сохранены (или сохранять было нечего). */
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
  /** Изменить поле строки (ввод пользователя). */
  updateRow: (row: EditorRow, field: RowField, value: string) => void
}

/**
 * Окно «Редактирование категорий»: статьи расходов и доходов и строки для новых статей. «Сохранить» отправляет
 * PATCH на каждую изменённую статью и POST на каждую заполненную новую строку — отдельными запросами
 * параллельно (пакетного эндпоинта нет): сохранённые статьи принимают значения из ответа, новые уходят в список,
 * у несохранённых остаются введённые значения и ошибка. Тип статьи не меняется: колонки фиксированы.
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
      columns.outcome.categories = outcome.map(categoryRow)
      columns.income.categories = income.map(categoryRow)
    } catch {
      loadFailed.value = true
    } finally {
      loading.value = false
    }
  }

  async function send(request: SaveRequest): Promise<void> {
    if (request.kind === 'update') {
      const updated = await updateCategory(request.row.category.uid, request.body)
      Object.assign(request.row, fieldValues(updated), { category: updated })
      return
    }
    const { column, row, body } = request
    const created = await createCategory(body)
    // NOTE(FM-42): созданная статья добавляется в конец в порядке ответов, а не по названию, как в
    // GET /categories; порядок восстанавливается при следующем открытии окна.
    column.categories.push(categoryRow(created))
    column.rows.splice(column.rows.indexOf(row), 1)
  }

  async function saveRow(request: SaveRequest): Promise<boolean> {
    const { row } = request
    try {
      await send(request)
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

    const requests: SaveRequest[] = []
    let invalid = false
    for (const column of Object.values(columns)) {
      for (const row of [...column.categories, ...column.rows]) {
        row.message = null
        row.errors = {}
      }
      // Дубликат — у того, кто занял название позже: сначала нетронутые статьи, затем новые строки, затем
      // изменённые статьи — ошибку получает переименование, а не строка, совпавшая с ним
      // NOTE(FM-46): обмен названиями двух статей проходит проверку, но параллельные PATCH получат 409 — у одной
      // или обеих строк «Такая статья уже есть»; обмен делается в два сохранения через промежуточное название.
      const changed = column.categories.filter((row) => !isUntouched(row))
      const takenNames = new Set(
        column.categories.filter(isUntouched).map((row) => row.category.name),
      )
      for (const row of column.rows) {
        if (isBlank(row)) continue
        const values = validateRow(row, takenNames)
        if (!values) invalid = true
        else
          requests.push({
            kind: 'create',
            column,
            row,
            body: { ...values, category_type: column.type },
          })
      }
      for (const row of changed) {
        const values = validateRow(row, takenNames)
        if (!values) invalid = true
        else {
          const body = changedFields(row.category, values)
          if (Object.keys(body).length) requests.push({ kind: 'update', row, body })
        }
      }
    }
    if (invalid) return null

    saving.value = true
    try {
      const results = await Promise.all(requests.map(saveRow))
      const saved = results.filter(Boolean).length
      return { saved, complete: saved === results.length }
    } finally {
      saving.value = false
    }
  }

  // TODO(FM-42): ошибка поля (в том числе 409/422 от сервера) остаётся до следующего «Сохранить», хотя поле
  // уже исправлено — сбрасывать ошибку поля (и ошибку строки) при вводе.
  function updateRow(row: EditorRow, field: RowField, value: string): void {
    row[field] = value
  }

  return { columns, loading, loadFailed, message, saving, load, save, updateRow }
}
