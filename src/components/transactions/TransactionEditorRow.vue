<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { Category } from '@/types/category'
import { buildChanges, type EditorField, type TransactionDraft } from '@/transactions/editorModel'
import { formatMoney } from '@/utils/money'
const props = defineProps<{
  draft: TransactionDraft
  categories: Category[]
  selected: boolean
  busy: boolean
  unresolved: boolean
}>()
const emit = defineEmits<{
  edit: [field: EditorField, value: string]
  select: []
  revert: []
  reconcile: []
}>()
const active = ref<EditorField | null>(null)
const before = ref('')
const row = ref<HTMLElement>()
const dirty = computed(
  /** Определяет индикатор несохранённых полей. */ () =>
    Object.keys(buildChanges(props.draft)).length > 0,
)
const fields: { key: EditorField; label: string }[] = [
  { key: 'date', label: 'Дата' },
  { key: 'category_uid', label: 'Категория' },
  { key: 'description', label: 'Комментарий' },
  { key: 'amount', label: 'Сумма' },
]
/** Возвращает подпись неактивной ячейки. */
function display(field: EditorField) {
  const value = props.draft.values[field]
  if (field === 'date') return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}`
  if (field === 'amount') {
    const number = Number(value.replace(/\s/g, ''))
    return Number.isFinite(number) && value ? formatMoney(number) : value || '—'
  }
  if (field === 'category_uid')
    return (
      props.categories.find(/** Находит название выбранной статьи. */ (c) => c.uid === value)
        ?.name ?? props.draft.original.category.name
    )
  return value || '—'
}
/** Активирует редактор и переносит фокус без изменения значения. */
async function begin(field: EditorField) {
  if (props.busy) return
  before.value = props.draft.values[field]
  active.value = field
  await nextTick()
  row.value?.querySelector<HTMLElement>('[data-cell-input]')?.focus()
}
/** Завершает редактирование с возвратом фокуса на ячейку. */
async function finish(cancel = false) {
  const field = active.value
  if (!field) return
  if (cancel) emit('edit', field, before.value)
  active.value = null
  await nextTick()
  row.value?.querySelector<HTMLElement>(`[data-field="${field}"]`)?.focus()
}
/** Обрабатывает отмену и подтверждение внутри ячейки. */
function keydown(event: KeyboardEvent) {
  if (!active.value) return
  if (event.key === 'Escape') {
    event.stopPropagation()
    event.preventDefault()
    void finish(true)
  } else if (event.key === 'Enter' && !(event.target instanceof HTMLTextAreaElement)) {
    event.preventDefault()
    void finish()
  }
}
/** Передаёт ввод родителю, сохраняя единственный источник состояния. */
function update(field: EditorField, event: Event) {
  emit('edit', field, (event.target as HTMLInputElement).value)
}
const inputClass =
  'min-h-9 w-full min-w-0 rounded border border-field-border bg-field px-2 py-1 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus sm:text-caption'
</script>
<template>
  <div
    ref="row"
    role="row"
    :data-uid="draft.original.uid"
    :class="selected ? 'bg-action/20' : ''"
    class="grid min-w-0 grid-cols-[28px_minmax(0,1fr)] gap-x-2 border-b border-ink/10 px-2 py-2 sm:grid-cols-[24px_100px_minmax(100px,1fr)_minmax(120px,2fr)_110px_32px] sm:items-start"
    @keydown="keydown"
  >
    <div role="cell" class="row-span-5 flex min-h-9 items-center self-start sm:row-span-1">
      <input
        type="checkbox"
        aria-label="Выбрать операцию"
        :checked="selected"
        :disabled="busy"
        class="size-4 accent-action"
        @change="emit('select')"
      />
    </div>
    <div v-for="field in fields" :key="field.key" role="cell" class="min-w-0">
      <span class="text-caption text-ink-muted sm:hidden">{{ field.label }}</span>
      <template v-if="active === field.key">
        <select
          v-if="field.key === 'category_uid'"
          data-cell-input
          :aria-label="field.label"
          :value="draft.values[field.key]"
          :disabled="busy"
          :class="inputClass"
          :aria-invalid="!!draft.errors[field.key]"
          :aria-describedby="
            draft.errors[field.key] ? `${draft.original.uid}-${field.key}-error` : undefined
          "
          @change="update(field.key, $event)"
          @blur="active = null"
        >
          <option
            v-if="!categories.some(/** Проверяет наличие выбранной категории. */ (c) => c.uid === draft.values.category_uid)"
            :value="draft.values.category_uid"
          >
            {{ draft.original.category.name }}
          </option>
          <option v-for="category in categories" :key="category.uid" :value="category.uid">
            {{ category.name }}
          </option>
        </select>
        <textarea
          v-else-if="field.key === 'description'"
          data-cell-input
          :aria-label="field.label"
          :value="draft.values[field.key]"
          :disabled="busy"
          :class="inputClass"
          :aria-invalid="!!draft.errors[field.key]"
          :aria-describedby="
            draft.errors[field.key] ? `${draft.original.uid}-${field.key}-error` : undefined
          "
          rows="2"
          @input="update(field.key, $event)"
          @blur="active = null"
        />
        <input
          v-else
          data-cell-input
          :aria-label="field.label"
          :type="field.key === 'date' ? 'date' : 'text'"
          :inputmode="field.key === 'amount' ? 'numeric' : undefined"
          :min="field.key === 'date' ? '2000-01-01' : undefined"
          :max="field.key === 'date' ? '2099-12-31' : undefined"
          :value="draft.values[field.key]"
          :disabled="busy"
          :class="inputClass"
          :aria-invalid="!!draft.errors[field.key]"
          :aria-describedby="
            draft.errors[field.key] ? `${draft.original.uid}-${field.key}-error` : undefined
          "
          @input="update(field.key, $event)"
          @blur="active = null"
        />
      </template>
      <button
        v-else
        type="button"
        :data-field="field.key"
        :disabled="busy"
        :aria-label="`${field.label}: ${display(field.key)}`"
        :aria-describedby="
          draft.errors[field.key] ? `${draft.original.uid}-${field.key}-error` : undefined
        "
        :class="field.key === 'amount' ? 'font-semibold sm:text-right' : 'text-left'"
        class="min-h-9 w-full min-w-0 break-words rounded px-2 py-1 text-caption hover:bg-field-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        @click="begin(field.key)"
      >
        {{ display(field.key) }}
      </button>
      <p
        v-if="draft.errors[field.key]"
        :id="`${draft.original.uid}-${field.key}-error`"
        role="alert"
        class="text-caption text-danger"
      >
        {{ draft.errors[field.key] }}
      </p>
    </div>
    <div role="cell" class="col-start-2 flex min-h-9 items-center sm:col-start-auto">
      <span
        v-if="dirty"
        aria-label="Несохранённые изменения"
        title="Несохранённые изменения"
        class="text-ink-muted"
        ><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="m14 5 5 5M4 20l5-1L20 8l-5-5L4 14z"
            stroke="currentColor"
            stroke-width="1.5"
          /></svg
      ></span>
    </div>
    <div
      v-if="dirty || draft.errors.row || unresolved"
      class="col-start-2 flex flex-wrap items-center gap-3 text-caption sm:col-span-5"
    >
      <p v-if="draft.errors.row" role="alert" class="text-danger">{{ draft.errors.row }}</p>
      <button
        v-if="unresolved"
        type="button"
        :disabled="busy"
        class="rounded underline focus-visible:outline"
        @click="emit('reconcile')"
      >
        Сверить данные
      </button>
      <button
        v-if="dirty && !unresolved"
        type="button"
        :disabled="busy"
        class="rounded text-ink-muted underline focus-visible:outline"
        @click="emit('revert')"
      >
        Отменить правки строки
      </button>
    </div>
  </div>
</template>
