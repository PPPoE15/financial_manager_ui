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
// TODO(FM-46): тип называется как компонент CategoryRow.vue, который рисует и новые строки, — переименовать
// (например, в ExistingRow), иначе импорт обоих в один файл потребует алиаса.
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
export const SWAP_ERROR =
  'Названия не обменять за одно сохранение — сначала переименуйте одну из статей во временное название'

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
// TODO(FM-46): план получается вырезанием «₽» и NBSP из formatMoney — смена её формата (см. TODO(FM-28)) оставит
// в поле «4 990 ₽», которое parsePlan отклонит. Вынести группировку разрядов в отдельный хелпер в utils/money.ts.
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
// TODO(FM-46): исходные значения полей пересчитываются через formatMoney при каждом «Сохранить» — хранить их
// в строке, созданной categoryRow() (заодно уйдёт зависимость от формата formatMoney, см. TODO выше).
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
/**
 * Исход запроса «Сохранить»: `saved`; `rejected` — ошибка у строки (дубликат, лимит, 422 по полю); `gone` — 404,
 * статьи нет; `failed` — общая ошибка окна (сеть, 5xx, неразобранный ответ).
 */
type SaveOutcome = 'saved' | 'rejected' | 'gone' | 'failed'

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
  // TODO(FM-46): строка удалённой статьи остаётся в окне — каждое «Сохранить» снова шлёт её PATCH (окно не
  // закрывается, пока её не вернут к исходным значениям), а её название занято для новых строк. Убирать строку
  // из колонки (и показывать сообщение окна), когда появится удаление статей.
  // TODO(FM-46): любой 404 считается «статья удалена» — без проверки кода ошибки и вида запроса: 404 на POST
  // (прокси, бэкенд без маршрута) покажет это у новой строки. Различать по коду и по create/update.
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
  | { kind: 'update'; column: EditorColumn; row: CategoryRow; body: CategoryUpdate }

/**
 * Переименование в том же сохранении, которое освобождает нужное запросу название (на сервере его ещё носит
 * другая статья колонки), или `undefined`. Названия в колонке уникальны, поэтому такой запрос не больше одного.
 */
function findHolder(request: SaveRequest, requests: SaveRequest[]): SaveRequest | undefined {
  const name = request.body.name
  if (name === undefined) return undefined
  return requests.find(
    (other) =>
      other !== request &&
      other.kind === 'update' &&
      other.column === request.column &&
      other.body.name !== undefined &&
      other.row.category.name === name,
  )
}

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

  async function saveRow(request: SaveRequest): Promise<SaveOutcome> {
    const { row } = request
    try {
      await send(request)
      return 'saved'
    } catch (error) {
      const windowMessage = applySaveError(row, error)
      if (windowMessage) {
        message.value = windowMessage
        return 'failed'
      }
      return isAxiosError(error) && error.response?.status === 404 ? 'gone' : 'rejected'
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
      // Дубликат — у того, кто занял название позже: сначала статьи со своим прежним названием (даже если у них
      // изменены план или комментарий), затем новые строки, затем переименованные статьи — ошибку получает
      // переименование, а не строка, совпавшая с ним
      // Здесь проверяются итоговые названия; порядок запросов для названий, которые освобождают переименования
      // (цепочка B → C, A → B; новая «A» при A → Y), — в run() ниже, обмен (A ↔ B) — сразу после проверки.
      const takenNames = new Set<string>()
      // TODO(FM-46): сохранённое название проверяется клиентскими правилами и при правке только плана: trim() в JS и
      // strip() в Python расходятся (U+FEFF, U+0085) — у статьи, созданной через API с таким краем названия, правка
      // плана отправит и `name`. Не проверять и не отправлять название, сырое значение которого равно category.name.
      const keepsName = (row: CategoryRow) => row.name.trim() === row.category.name
      const ordered: (CategoryRow | EditorRow)[] = [
        ...column.categories.filter(keepsName),
        ...column.rows,
        ...column.categories.filter((row) => !keepsName(row)),
      ]
      for (const row of ordered) {
        const existing = 'category' in row ? row : null
        if (existing ? isUntouched(existing) : isBlank(row)) {
          if (existing) takenNames.add(existing.category.name)
          continue
        }
        const values = validateRow(row, takenNames)
        if (!values) invalid = true
        else if (!existing)
          requests.push({
            kind: 'create',
            column,
            row,
            body: { ...values, category_type: column.type },
          })
        else {
          const body = changedFields(existing.category, values)
          if (Object.keys(body).length)
            requests.push({ kind: 'update', column, row: existing, body })
        }
      }
    }
    if (invalid) return null

    // Запрос на название, которое освобождает переименование другой статьи, ждёт это переименование: параллельно
    // сервер ответил бы 409 `FM-409101` или нет — в зависимости от порядка прихода. Остальные уходят сразу.
    // NOTE(FM-46): порядок запросов и отказ при обмене — обход уникальности названий без пакетного эндпоинта;
    // убрать его (и сделать обмен возможным) может пакетный PATCH или отложенная (DEFERRABLE) проверка уникальности
    // на сервере — это изменение контракта.
    // TODO(FM-46): тесты покрывают обмен двух статей; цикла из трёх (A → B → C → A) и цепочки, входящей в цикл
    // (C → A при A ↔ B), в тестах нет.
    const holders = new Map(requests.map((request) => [request, findHolder(request, requests)]))
    // Обмен названиями (цикл A → B → … → A) так не развязать — каждый ждёт другого; уникальность названий на
    // сервере не даёт сделать его за одно сохранение
    for (const request of requests) {
      const seen = new Set<SaveRequest>()
      let holder = holders.get(request)
      while (holder && holder !== request && !seen.has(holder)) {
        seen.add(holder)
        holder = holders.get(holder)
      }
      if (holder === request) {
        request.row.errors = { name: SWAP_ERROR }
        invalid = true
      }
    }
    if (invalid) return null

    const runs = new Map<SaveRequest, Promise<SaveOutcome>>()
    function run(request: SaveRequest): Promise<SaveOutcome> {
      let result = runs.get(request)
      if (!result) {
        const holder = holders.get(request)
        result = (async () => {
          const freed = holder ? await run(holder) : 'saved'
          // Переименование отклонено (409/422) — название так и осталось за другой статьёй
          if (freed === 'rejected') {
            request.row.errors = { name: DUPLICATE_ERROR }
            return 'rejected'
          }
          // Сеть / 5xx: исход неизвестен, ошибки у строки нет — общее сообщение окна уже показано, запрос не уходит
          if (freed === 'failed') return 'failed'
          // Сохранено или статьи уже нет (404) — название свободно
          return saveRow(request)
        })()
        runs.set(request, result)
      }
      return result
    }

    saving.value = true
    try {
      const results = await Promise.all(requests.map(run))
      const saved = results.filter((outcome) => outcome === 'saved').length
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
