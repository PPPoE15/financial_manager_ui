<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { routerKey } from 'vue-router'
import { listCategories } from '@/api/categories'
import { getTransaction } from '@/api/transactions'
import type { Category } from '@/types/category'
import type { TransactionType } from '@/types/budget'
import type { TransactionFilters } from '@/types/transaction'
import { useTransactionList } from '@/transactions/useTransactionList'
import { useTransactionEditor } from '@/transactions/useTransactionEditor'
import { buildChanges, validEditorDate } from '@/transactions/editorModel'
import { formatMoney } from '@/utils/money'
import TransactionEditorRow from './TransactionEditorRow.vue'
import TransactionBulkDialog from './TransactionBulkDialog.vue'
import TransactionLeaveDialog from './TransactionLeaveDialog.vue'
import TransactionConflictDialog from './TransactionConflictDialog.vue'
const props = defineProps<{ type: TransactionType; initialUid?: string }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const list = useTransactionList()
const { records, total, nextSkip, filters, loading, loadError, selectedUids } = list
filters.value.transaction_type = props.type
const editor = useTransactionEditor({
  refresh: list.reload,
  onChanged: /** Сообщает владельцу окна о необходимости обновить отчёты. */ () => emit('changed'),
})
const { draftsByUid, dirty, busy, message, unresolved, currentByUid, removedUids } = editor
const categories = ref<Category[]>([]),
  categoryError = ref('')
const panel = ref<HTMLElement>(),
  scrollArea = ref<HTMLElement>(),
  sentinel = ref<HTMLElement>(),
  main = ref<HTMLElement>()
const bulk = ref<'date' | 'category' | 'delete' | null>(null)
const leave = ref(false),
  conflictUid = ref<string | null>(null)
const period = ref('all'),
  after = ref(''),
  before = ref(''),
  filterError = ref('')
const externalUid = ref(props.initialUid ?? '')
let active = true,
  pendingAction: (() => Promise<void> | void) | undefined
let resolveLeave: ((value: boolean) => void) | undefined
let observer: IntersectionObserver | undefined, resize: ResizeObserver | undefined
let categoryGeneration = 0
const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
let subOpener: HTMLElement | null = null
const app = document.getElementById('app'),
  wasInert = app?.hasAttribute('inert') ?? false
const router = inject(routerKey, null)
let removeGuard: (() => void) | undefined
const nested = computed(
  /** Определяет активность вложенного подтверждения. */ () =>
    !!bulk.value || leave.value || !!conflictUid.value,
)
const rows = computed(
  /** Собирает строки текущей страницы, исключая подтверждённые удаления. */ () =>
    records.value
      .filter(
        /** Проверяет доступность строки после удаления. */ (row) =>
          !removedUids.value.has(row.uid),
      )
      .map(
        /** Подставляет пользовательский черновик вместо чтения сервера. */ (row) =>
          draftsByUid.value.get(row.uid),
      )
      .filter(/** Уточняет наличие черновика. */ (row) => !!row),
)
const retained = computed(
  /** Сохраняет видимость правок за пределами страницы или фильтра. */ () => {
    const visible = new Set(
      records.value.map(/** Собирает UID текущей страницы. */ (row) => row.uid),
    )
    return [...draftsByUid.value.values()].filter(
      /** Выделяет черновики и явно открытую запись вне страницы. */ (row) =>
        !visible.has(row.original.uid) &&
        !removedUids.value.has(row.original.uid) &&
        (Object.keys(buildChanges(row)).length ||
          unresolved.value.has(row.original.uid) ||
          row.original.uid === externalUid.value),
    )
  },
)
const selected = computed(
  /** Берёт только доступные выбранные записи. */ () =>
    [...selectedUids.value].filter(
      /** Исключает удалённые строки. */ (uid) =>
        draftsByUid.value.has(uid) && !removedUids.value.has(uid),
    ),
)
const selectedSum = computed(
  /** Суммирует сохранённые значения для подтверждения удаления. */ () =>
    selected.value.reduce(
      /** Прибавляет целочисленную сумму исходной операции. */ (sum, uid) =>
        sum + (draftsByUid.value.get(uid)?.original.money_sum ?? 0),
      0,
    ),
)
const selectedDirty = computed(
  /** Проверяет наличие правок среди удаляемых строк. */ () =>
    dirty.value.some(
      /** Проверяет принадлежность черновика выбору. */ (row) =>
        selected.value.includes(row.original.uid),
    ),
)
const allSelected = computed(
  /** Определяет состояние общего чекбокса. */ () =>
    rows.value.length > 0 &&
    rows.value.every(
      /** Проверяет выбор строки. */ (row) => selectedUids.value.has(row.original.uid),
    ),
)
const currentConflict = computed(
  /** Находит черновик для сверки. */ () =>
    conflictUid.value ? draftsByUid.value.get(conflictUid.value) : undefined,
)
watch(
  records,
  /** Принимает новый список без перезаписи черновиков. */ (value) => editor.ingest(value),
  { flush: 'sync' },
)

/** Возвращает текущую область удержания клавиатурного фокуса. */
function focusRoot() {
  return nested.value ? panel.value?.querySelector<HTMLElement>('[data-editor-dialog]') : main.value
}
/** Возвращает доступные контролы активного окна. */
function focusables() {
  return [
    ...(focusRoot()?.querySelectorAll<HTMLElement>(
      'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
    ) ?? []),
  ]
}
/** Не допускает переход фокуса на затенённый фон. */
function keepFocus() {
  if (active && (!focusRoot()?.contains(document.activeElement) || document.activeElement?.matches(':disabled') || document.activeElement === focusRoot()))
    (focusables()[0] ?? focusRoot())?.focus()
}
/** Восстанавливает фокус после смены вложенного окна. */
async function focusChanged() {
  if (nested.value)
    subOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  await nextTick()
  main.value?.toggleAttribute('inert', nested.value)
  if (!nested.value && subOpener?.isConnected) subOpener.focus()
  keepFocus()
}
watch(nested, focusChanged)
/** Загружает категории выбранного типа с защитой от запоздавшего ответа. */
async function loadCategories() {
  const generation = ++categoryGeneration
  categoryError.value = ''
  try {
    const result = await listCategories(filters.value.transaction_type)
    if (active && generation === categoryGeneration) categories.value = result
  } catch {
    if (active && generation === categoryGeneration)
      categoryError.value = 'Не удалось загрузить категории'
  }
}
/** Выполняет действие только после явного решения о несохранённых правках. */
async function requestAction(action: () => Promise<void> | void) {
  if (busy.value) return
  if (dirty.value.length) {
    pendingAction = action
    leave.value = true
    return
  }
  await action()
}
/** Возвращает отображаемые границы к реально применённому серверному фильтру. */
function restorePeriod() {
  after.value = filters.value.after?.slice(0, 10) || ''
  before.value = filters.value.before?.slice(0, 10) || ''
  period.value = after.value || before.value ? 'range' : 'all'
  filterError.value = ''
}
/** Завершает подтверждение перехода, сохраняя окно при ошибке записи. */
async function chooseLeave(choice: 'save' | 'discard' | 'stay') {
  if (busy.value) return
  if (choice === 'stay') {
    restorePeriod()
    leave.value = false
    pendingAction = undefined
    resolveLeave?.(false)
    resolveLeave = undefined
    return
  }
  leave.value = false
  if (choice === 'save' && !(await editor.save())) {
    restorePeriod()
    pendingAction = undefined
    resolveLeave?.(false)
    resolveLeave = undefined
    await focusError()
    return
  }
  if (choice === 'discard') editor.discard()
  const action = pendingAction
  pendingAction = undefined
  await action?.()
  resolveLeave?.(true)
  resolveLeave = undefined
}
/** Запрашивает закрытие с защитой несохранённых изменений. */
function requestClose() {
  void requestAction(/** Закрывает окно после разрешения пользователя. */ () => emit('close'))
}
/** Применяет новый серверный фильтр после защиты черновиков. */
function changeFilters(next: TransactionFilters) {
  void requestAction(
    /** Сбрасывает локальный контекст и перечитывает новый список. */ async () => {
      draftsByUid.value.clear()
      externalUid.value = ''
      removedUids.value.clear()
      unresolved.value.clear()
      currentByUid.value.clear()
      const typeChanged = next.transaction_type !== filters.value.transaction_type
      if (typeChanged) {
        categoryGeneration++
        categoryError.value = ''
        categories.value = []
        next = { ...next, category_uid: undefined }
      }
      await list.setFilters(next)
      if (typeChanged) await loadCategories()
      if (scrollArea.value) scrollArea.value.scrollTop = 0
    },
  )
}
/** Согласует календарные границы с включительным диапазоном API. */
function applyPeriod() {
  filterError.value = ''
  if (
    period.value === 'range' &&
    ((!after.value && !before.value) ||
      (after.value && !validEditorDate(after.value)) ||
      (before.value && !validEditorDate(before.value)) ||
      (after.value && before.value && after.value > before.value))
  ) {
    filterError.value = 'Укажите корректный период с 2000 по 2099 год'
    return
  }
  changeFilters({
    ...filters.value,
    after: period.value === 'range' && after.value ? `${after.value}T00:00:00` : undefined,
    before:
      period.value === 'range' && before.value ? `${before.value}T23:59:59.999999` : undefined,
  })
}
/** Меняет выбор одной строки, не затрагивая набор сохраняемых правок. */
function toggle(uid: string) {
  if (!busy.value) {
    if (selectedUids.value.has(uid)) selectedUids.value.delete(uid)
    else selectedUids.value.add(uid)
  }
}
/** Выполняет подтверждённое массовое действие. */
async function applyBulk(value: string) {
  const mode = bulk.value
  if (mode === 'delete') {
    await editor.remove(selected.value)
    for (const uid of removedUids.value) selectedUids.value.delete(uid)
  } else if (mode === 'date') editor.applyDate(selected.value, value)
  else if (mode === 'category') editor.applyCategory(selected.value, value)
  bulk.value = null
}
/** Открывает актуальные данные конкретной конфликтующей операции. */
async function reconcile(uid: string) {
  conflictUid.value = uid
  await editor.reconcile(uid)
}
/** Принимает явное решение пользователя о конфликте. */
function resolveConflict(reapply: boolean) {
  if (!conflictUid.value) return
  if (reapply) editor.reapplyDraft(conflictUid.value)
  else editor.acceptServer(conflictUid.value)
  conflictUid.value = null
}
/** Фокусирует первое ошибочное поле, включая скрытый редактор ячейки. */
async function focusError() {
  await nextTick()
  const invalid = main.value?.querySelector<HTMLElement>(
    '[aria-invalid="true"], [aria-describedby$="-error"]',
  )
  invalid?.scrollIntoView?.({ block: 'nearest' })
  ;(invalid ?? main.value?.querySelector<HTMLElement>('[data-save]'))?.focus()
}
/** Сохраняет все черновики и показывает первое препятствие при неуспехе. */
async function save() {
  if (!(await editor.save())) await focusError()
}
/** Защищает перезагрузку и закрытие вкладки штатным диалогом браузера. */
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value.length || busy.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
/** Удерживает Tab в активном диалоге и направляет Escape ближайшему окну. */
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    if (busy.value) return
    if (bulk.value) bulk.value = null
    else if (conflictUid.value) conflictUid.value = null
    else if (leave.value) void chooseLeave('stay')
    else requestClose()
    return
  }
  if (event.key !== 'Tab') return
  const items = focusables(),
    first = items[0],
    last = items[items.length - 1]
  if (!items.length) {
    event.preventDefault()
    focusRoot()?.focus()
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}
/** Загружает следующую порцию только при видимом конце списка без активной ошибки. */
function observeEnd(entries: IntersectionObserverEntry[]) {
  if (
    entries.some(/** Проверяет видимость конца прокрутки. */ (entry) => entry.isIntersecting) &&
    !loading.value &&
    !loadError.value &&
    !busy.value
  )
    void list.loadMore()
}
/** Настраивает наблюдение после обновления списка и размеров области. */
function reconnect() {
  if (sentinel.value) {
    observer?.unobserve(sentinel.value)
    observer?.observe(sentinel.value)
  }
}
watch(
  [loading, busy],
  /** Возобновляет подгрузку после завершения запроса. */ async () => {
    await nextTick()
    keepFocus()
    reconnect()
  },
)
onMounted(
  /** Загружает список и настраивает модальность окна. */ async () => {
    app?.setAttribute('inert', '')
    document.addEventListener('focusin', keepFocus)
    window.addEventListener('beforeunload', beforeUnload)
    removeGuard = router?.beforeEach(
      /** Защищает переход маршрута, не блокируя истечение сессии. */ async (to) => {
        if (to.name === 'login') return true
        if (busy.value) return false
        if (!dirty.value.length) return true
        if (resolveLeave) return false
        leave.value = true
        return new Promise<boolean>(
          /** Сохраняет решение для продолжения навигации. */ (resolve) => {
            resolveLeave = resolve
          },
        )
      },
    )
    await nextTick()
    keepFocus()
    await Promise.all([
      list.loadInitial(scrollArea.value?.clientHeight || 400, window.innerWidth < 640 ? 210 : 40),
      loadCategories(),
    ])
    if (!active) return
    if (props.initialUid) {
      if (!draftsByUid.value.has(props.initialUid)) {
        try {
          const initial = await getTransaction(props.initialUid)
        if (initial) editor.ingest([initial])
        else message.value = 'Операция не найдена при сверке списка. Обновите список.'
        } catch {
          message.value = 'Операция недоступна или удалена.'
        }
      }
      await nextTick()
      const target = [...(main.value?.querySelectorAll<HTMLElement>('[data-uid]') ?? [])].find(
        /** Находит исходную строку карточки. */ (el) => el.dataset.uid === props.initialUid,
      )
      target?.scrollIntoView?.({ block: 'center' })
      target?.querySelector<HTMLElement>('[data-field]')?.focus()
    }
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(observeEnd, {
        root: scrollArea.value,
        rootMargin: '80px',
      })
      reconnect()
    }
    if (typeof ResizeObserver !== 'undefined' && scrollArea.value) {
      resize = new ResizeObserver(reconnect)
      resize.observe(scrollArea.value)
    }
  },
)
onBeforeUnmount(
  /** Освобождает фокус, наблюдатели и защиту навигации. */ () => {
    active = false
    categoryGeneration++
    observer?.disconnect()
    resize?.disconnect()
    removeGuard?.()
    resolveLeave?.(false)
    document.removeEventListener('focusin', keepFocus)
    window.removeEventListener('beforeunload', beforeUnload)
    app?.toggleAttribute('inert', wasInert)
    opener?.focus()
  },
)
defineExpose({ requestClose })
</script>
<template>
  <Teleport to="body">
    <div
      ref="panel"
      data-editor-panel
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-dialog-backdrop/40 p-2 font-sans text-ink backdrop-blur-md sm:p-6"
      @keydown="keydown"
    >
      <section
        ref="main"
        role="dialog"
        aria-modal="true"
        aria-labelledby="operations-title"
        tabindex="-1"
        class="relative my-auto flex max-h-[calc(100dvh-1rem)] min-h-[min(500px,90dvh)] w-full max-w-[1120px] flex-col rounded-md bg-gradient-to-r from-dialog-start/95 to-dialog-end/95 p-3 shadow-xl sm:max-h-[calc(100dvh-3rem)] sm:p-7"
      >
        <header class="shrink-0">
          <div class="flex items-center justify-between">
            <h1 id="operations-title" class="text-xl font-bold">Операции</h1>
            <button
              type="button"
              aria-label="Закрыть операции"
              :disabled="busy"
              class="size-10 rounded text-xl focus-visible:outline"
              @click="requestClose"
            >
              ×
            </button>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-3">
            <div class="flex rounded bg-field p-1">
              <button
                v-for="type in ['outcome', 'income'] as const"
                :key="type"
                type="button"
                :aria-pressed="filters.transaction_type === type"
                :disabled="busy"
                :class="
                  filters.transaction_type === type
                    ? 'bg-action text-action-foreground'
                    : 'text-ink-muted'
                "
                class="min-h-8 rounded px-5 text-caption font-medium focus-visible:outline"
                @click="changeFilters({ ...filters, transaction_type: type })"
              >
                {{ type === 'outcome' ? 'Расходы' : 'Доходы' }}
              </button>
            </div>
            <p class="text-caption text-ink-muted">Нажмите на поле, чтобы изменить его</p>
            <label class="sm:ml-auto"
              ><span class="sr-only">Период</span
              ><select
                v-model="period"
                :disabled="busy"
                class="min-h-9 max-w-full rounded bg-field px-3 text-caption"
                @change="applyPeriod"
              >
                <option value="all">За всё время</option>
                <option value="range">Выбрать период</option>
              </select></label
            >
            <label
              ><span class="sr-only">Фильтр категории</span
              ><select
                :value="filters.category_uid || ''"
                :disabled="busy"
                class="min-h-9 max-w-[200px] rounded bg-field px-3 text-caption"
                @change="
                  changeFilters({
                    ...filters,
                    category_uid: ($event.target as HTMLSelectElement).value || undefined,
                  })
                "
              >
                <option value="">Все категории</option>
                <option v-for="c in categories" :key="c.uid" :value="c.uid">{{ c.name }}</option>
              </select></label
            >
          </div>
          <div v-if="period === 'range'" class="mt-3 flex flex-wrap gap-2 text-caption">
            <label
              >От
              <input
                v-model="after"
                aria-label="От"
                type="date"
                min="2000-01-01"
                max="2099-12-31"
                :disabled="busy"
                class="min-h-9 rounded bg-field px-2" /></label
            ><label
              >До
              <input
                v-model="before"
                aria-label="До"
                type="date"
                min="2000-01-01"
                max="2099-12-31"
                :disabled="busy"
                class="min-h-9 rounded bg-field px-2" /></label
            ><button
              type="button"
              :disabled="busy"
              class="rounded bg-action px-3 text-action-foreground"
              @click="applyPeriod"
            >
              Применить период
            </button>
          </div>
          <p v-if="filterError" role="alert" class="mt-2 text-sm text-danger">{{ filterError }}</p>
          <p v-if="categoryError" role="alert" class="mt-2 text-sm text-danger">
            {{ categoryError }}
            <button type="button" :disabled="busy" class="underline" @click="loadCategories">
              Повторить категории
            </button>
          </p>
          <div class="my-3 flex flex-wrap items-center gap-2 rounded bg-field/70 p-2 text-caption">
            <strong>Выбрано: {{ selected.length }}</strong
            ><span class="mr-4 text-ink-muted">{{ formatMoney(selectedSum) }}</span>
            <button
              type="button"
              :disabled="busy || !selected.length || selected.length > 100"
              class="min-h-8 rounded bg-action/40 px-3 disabled:opacity-50 focus-visible:outline"
              @click="bulk = 'date'"
            >
              Изменить дату
            </button>
            <button
              type="button"
              :disabled="busy || !selected.length || selected.length > 100 || !categories.length"
              class="min-h-8 rounded bg-action/40 px-3 disabled:opacity-50 focus-visible:outline"
              @click="bulk = 'category'"
            >
              Изменить категорию
            </button>
            <button
              type="button"
              :disabled="busy || !selected.length || selected.length > 100"
              class="min-h-8 rounded bg-destructive px-4 text-white disabled:opacity-50 focus-visible:outline"
              @click="bulk = 'delete'"
            >
              Удалить
            </button>
            <button
              type="button"
              :disabled="busy || !selected.length"
              class="min-h-8 rounded px-2 text-ink-muted focus-visible:outline sm:ml-auto"
              @click="selectedUids.clear()"
            >
              Снять выбор
            </button>
          </div>
          <p
            v-if="selected.length > 100 || dirty.length > 100"
            role="alert"
            class="mb-2 text-sm text-danger"
          >
            За один раз можно обработать не больше 100 операций. Уменьшите выбор или отмените лишние
            правки строк.
          </p>
        </header>
        <div
          ref="scrollArea"
          class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          :aria-busy="loading || busy"
        >
          <div role="table" aria-label="Операции" class="min-w-0">
            <div
              role="row"
              class="sticky top-0 z-10 grid grid-cols-[28px_minmax(0,1fr)] gap-2 rounded bg-field p-2 text-caption font-semibold sm:grid-cols-[24px_100px_minmax(100px,1fr)_minmax(120px,2fr)_110px_32px]"
            >
              <div role="columnheader">
                <input
                  type="checkbox"
                  aria-label="Выбрать загруженные операции"
                  :checked="allSelected"
                  :disabled="busy || !rows.length"
                  class="size-4 accent-action"
                  @change="list.toggleAllLoaded"
                />
              </div>
              <div role="columnheader">
                <button
                  type="button"
                  :disabled="busy"
                  :aria-label="
                    filters.sort === '-transaction_date'
                      ? 'Дата: сначала новые'
                      : 'Дата: сначала старые'
                  "
                  class="rounded focus-visible:outline"
                  @click="
                    changeFilters({
                      ...filters,
                      sort:
                        filters.sort === '-transaction_date'
                          ? 'transaction_date'
                          : '-transaction_date',
                    })
                  "
                >
                  Дата {{ filters.sort === '-transaction_date' ? '↓' : '↑' }}
                </button>
              </div>
              <div role="columnheader" class="hidden sm:block">Категория</div>
              <div role="columnheader" class="hidden sm:block">Комментарий</div>
              <div role="columnheader" class="hidden text-right sm:block">Сумма</div>
              <div role="columnheader" class="sr-only">Правки</div>
            </div>
            <TransactionEditorRow
              v-for="row in rows"
              :key="row.original.uid"
              :draft="row"
              :categories="categories"
              :selected="selectedUids.has(row.original.uid)"
              :busy="busy"
              :unresolved="unresolved.has(row.original.uid)"
              @edit="/** Передаёт изменение поля в черновик операции. */ (field, value) => editor.edit(row.original.uid, field, value)"
              @select="toggle(row.original.uid)"
              @revert="editor.discard(row.original.uid)"
              @reconcile="reconcile(row.original.uid)"
            />
          </div>
          <p
            v-if="!loading && !loadError && !rows.length"
            class="py-10 text-center text-sm text-ink-muted"
          >
            Операций пока нет
          </p>
          <p v-if="loading" role="status" class="py-4 text-center text-sm text-ink-muted">
            Загрузка…
          </p>
          <div v-if="loadError" role="alert" class="py-4 text-center text-sm text-danger">
            {{ loadError }}
            <button
              type="button"
              :disabled="busy || loading"
              class="rounded underline"
              @click="list.retry"
            >
              Повторить загрузку
            </button>
          </div>
          <div ref="sentinel" aria-hidden="true" class="h-1" />
          <button
            v-if="nextSkip !== null && !loadError"
            type="button"
            :disabled="loading || busy"
            class="mx-auto block min-h-9 rounded px-4 text-caption text-ink-muted focus-visible:outline"
            @click="list.loadMore"
          >
            Загрузить ещё
          </button>
          <section v-if="retained.length" class="mt-4 border-t border-ink/20 pt-3">
            <h2 class="mb-2 text-sm font-semibold">Операции вне текущей страницы</h2>
            <p class="mb-2 text-caption text-ink-muted">
              Их правки сохраняются вместе с остальными строками.
            </p>
            <TransactionEditorRow
              v-for="row in retained"
              :key="row.original.uid"
              :draft="row"
              :categories="categories"
              :selected="selectedUids.has(row.original.uid)"
              :busy="busy"
              :unresolved="unresolved.has(row.original.uid)"
              @edit="/** Передаёт изменение поля в черновик операции. */ (field, value) => editor.edit(row.original.uid, field, value)"
              @select="toggle(row.original.uid)"
              @revert="editor.discard(row.original.uid)"
              @reconcile="reconcile(row.original.uid)"
            />
          </section>
        </div>
        <footer class="shrink-0 pt-4">
          <p v-if="message" role="alert" class="mb-3 text-sm text-danger">{{ message }}</p>
          <div class="flex flex-wrap items-center gap-3 text-caption">
            <span class="text-ink-muted">Всего операций: {{ total }}</span
            ><span v-if="dirty.length" class="sm:ml-auto"
              >Есть несохранённые изменения: {{ dirty.length }}</span
            ><button
              data-save
              type="button"
              :disabled="busy || !dirty.length || dirty.length > 100"
              class="ml-auto min-h-control rounded bg-action px-6 font-semibold text-action-foreground focus-visible:outline disabled:bg-action-disabled disabled:text-action-disabled-foreground"
              @click="save"
            >
              {{ busy ? 'Обработка…' : 'Сохранить' }}
            </button>
          </div>
        </footer>
      </section>
      <div
        v-if="nested"
        class="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-dialog-backdrop/70 p-3"
      >
        <TransactionBulkDialog
          v-if="bulk"
          :mode="bulk"
          :count="selected.length"
          :sum="selectedSum"
          :categories="categories"
          :has-drafts="selectedDirty"
          :busy="busy"
          @cancel="bulk = null"
          @apply="applyBulk"
        />
        <TransactionLeaveDialog v-else-if="leave" :busy="busy" @choose="chooseLeave" />
        <TransactionConflictDialog
          v-else-if="conflictUid && currentConflict"
          :draft="currentConflict"
          :current="currentByUid.get(conflictUid)"
          :busy="busy"
          @cancel="conflictUid = null"
          @retry="reconcile(conflictUid!)"
          @accept="resolveConflict(false)"
          @reapply="resolveConflict(true)"
        />
      </div>
    </div>
  </Teleport>
</template>
