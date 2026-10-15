<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import { useTransactionEntry } from '@/transactions/useTransactionEntry'
import type { TransactionType } from '@/types/budget'

const props = defineProps<{ type: TransactionType }>()
const emit = defineEmits<{ saved: []; close: []; editCategories: [] }>()
const { rows, categories, date, dateError, loading, loadFailed, saving, load, update, save } =
  useTransactionEntry(props.type)
const id = useId()
const panel = ref<HTMLElement | null>(null)
const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
const app = document.getElementById('app')
const wasInert = app?.hasAttribute('inert') ?? false
let active = true
const fields = 'button:not([disabled]), input:not([disabled]), select:not([disabled])'
function focusables() {
  return [...(panel.value?.querySelectorAll<HTMLElement>(fields) ?? [])]
}
function keepFocus() {
  if (active && !panel.value?.contains(document.activeElement)) focusables()[0]?.focus()
}
function close() {
  if (!saving.value) emit('close')
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab') return
  const items = focusables()
  const first = items[0],
    last = items[items.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}
async function onLoad() {
  await load()
  await nextTick()
  keepFocus()
}
async function submit() {
  const result = await save()
  if (!active || !result) return
  if (result.saved) emit('saved')
  if (result.complete) {
    emit('close')
    return
  }
  await nextTick()
  const invalid = panel.value?.querySelector<HTMLElement>('[aria-invalid="true"]')
  const failedRow = panel.value?.querySelector<HTMLElement>('[data-row-error="true"]')
  const target = invalid ?? failedRow?.querySelector<HTMLElement>(fields)
  target?.focus()
  ;(invalid ?? failedRow)?.scrollIntoView?.({ block: 'nearest' })
  keepFocus()
}
watch([saving, () => rows.value.length], async () => {
  await nextTick()
  keepFocus()
})
onMounted(async () => {
  app?.setAttribute('inert', '')
  document.addEventListener('focusin', keepFocus)
  await nextTick()
  keepFocus()
  await onLoad()
})
onBeforeUnmount(() => {
  active = false
  document.removeEventListener('focusin', keepFocus)
  app?.toggleAttribute('inert', wasInert)
  opener?.focus()
})
const fieldClass =
  'h-[46px] w-full min-w-0 rounded-sm border border-transparent bg-field px-[15px] text-base font-medium text-ink placeholder:font-normal placeholder:text-ink-placeholder focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:text-sm'
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-dialog-backdrop/40 px-4 py-8 font-sans text-ink backdrop-blur-md"
    >
      <!-- FM-51: PDF-экспорт Figma, окно 800×672, поля 65px, колонки 184/185/292.
           Узкий экран и служебные состояния согласованы отдельно; токены общей темы. -->
      <div
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`${id}-title`"
        class="relative my-auto flex w-full max-w-[800px] flex-col rounded-[15px] bg-gradient-to-r from-dialog-start/70 to-dialog-end/70 px-4 pb-6 pt-12 shadow-xl sm:px-[65px] sm:pb-[27px] sm:pt-[46px] [@media(min-height:540px)]:min-h-[min(672px,calc(100dvh-4rem))] [@media(min-height:540px)]:max-h-[calc(100dvh-4rem)]"
        @keydown="keydown"
      >
        <button
          type="button"
          aria-label="Закрыть"
          :disabled="saving"
          class="absolute right-3 top-3 flex size-10 items-center justify-center rounded text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
          @click="close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </button>
        <form class="flex min-h-0 flex-1 flex-col" novalidate @submit.prevent="submit">
          <header class="flex shrink-0 flex-wrap items-center justify-between gap-4">
            <h2 :id="`${id}-title`" class="text-xl font-bold sm:text-2xl">
              {{ type === 'income' ? 'Учесть новые доходы' : 'Учесть новые расходы' }}
            </h2>
            <div class="min-w-0">
              <input
                v-model="date"
                type="date"
                aria-label="Дата"
                min="2000-01-01"
                max="2099-12-31"
                :readonly="saving"
                :aria-invalid="dateError ? 'true' : undefined"
                :aria-describedby="dateError ? `${id}-date-error` : undefined"
                class="min-h-8 max-w-full rounded bg-field px-3 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                @input="dateError = ''"
              />
              <ErrorMessage :id="`${id}-date-error`" :message="dateError" />
            </div>
          </header>
          <p
            role="status"
            :class="loading ? 'py-16 text-center text-sm text-ink-muted' : 'sr-only'"
          >
            {{ loading ? 'Загрузка…' : '' }}
          </p>
          <div
            v-if="!loading && loadFailed"
            class="flex flex-col items-center gap-4 py-16 text-center"
          >
            <ErrorMessage message="Не удалось загрузить статьи" /><BaseButton
              variant="secondary"
              @click="onLoad"
              >Повторить</BaseButton
            >
          </div>
          <div
            v-else-if="!loading && !categories.length"
            class="flex flex-col items-center gap-4 py-16 text-center"
          >
            <p>{{ type === 'income' ? 'Статей доходов пока нет' : 'Статей расходов пока нет' }}</p>
            <BaseButton variant="secondary" @click="emit('editCategories')"
              >Редактировать категории</BaseButton
            >
          </div>
          <template v-else-if="!loading">
            <div class="relative -mx-1 mb-8 mt-[31px] min-h-0 flex-1 overflow-y-auto px-1 pb-1">
              <div
                aria-hidden="true"
                class="mb-3 hidden grid-cols-[184fr_185fr_292fr] gap-[5px] px-1 text-base sm:grid"
              >
                <span>Категория</span><span>Сумма</span><span>Комментарий</span>
              </div>
              <div
                v-for="(row, index) in rows"
                :key="row.key"
                data-testid="transaction-row"
                role="group"
                :aria-label="`Запись ${index + 1}`"
                :data-row-error="Boolean(row.message)"
                class="mb-4 sm:mb-[5px]"
              >
                <div class="grid gap-[5px] sm:grid-cols-[184fr_185fr_292fr]">
                  <div class="min-w-0">
                    <label
                      :for="`${id}-${row.key}-category`"
                      class="mb-1 block text-caption sm:sr-only"
                      >Категория</label
                    >
                    <select
                      :id="`${id}-${row.key}-category`"
                      :value="row.category"
                      :disabled="saving"
                      :class="[fieldClass, row.errors.category && 'border-danger']"
                      :aria-invalid="row.errors.category ? 'true' : undefined"
                      :aria-describedby="
                        row.errors.category ? `${id}-${row.key}-category-error` : undefined
                      "
                      @change="update(row, 'category', ($event.target as HTMLSelectElement).value)"
                    >
                      <option value="" disabled>Выберите категорию</option>
                      <option
                        v-for="category in categories"
                        :key="category.uid"
                        :value="category.uid"
                      >
                        {{ category.name }}
                      </option>
                    </select>
                    <ErrorMessage
                      :id="`${id}-${row.key}-category-error`"
                      :message="row.errors.category"
                    />
                  </div>
                  <div class="min-w-0">
                    <label
                      :for="`${id}-${row.key}-amount`"
                      class="mb-1 block text-caption sm:sr-only"
                      >Сумма ₽</label
                    >
                    <div class="relative">
                      <input
                        :id="`${id}-${row.key}-amount`"
                        :value="row.amount"
                        :readonly="saving"
                        type="text"
                        inputmode="numeric"
                        placeholder="Введите сумму"
                        :class="[fieldClass, 'pr-9', row.errors.amount && 'border-danger']"
                        :aria-invalid="row.errors.amount ? 'true' : undefined"
                        :aria-describedby="
                          row.errors.amount ? `${id}-${row.key}-amount-error` : undefined
                        "
                        @input="update(row, 'amount', ($event.target as HTMLInputElement).value)"
                      />
                      <span
                        v-if="row.amount"
                        aria-hidden="true"
                        class="pointer-events-none absolute inset-y-0 right-[15px] flex items-center text-sm"
                        >₽</span
                      >
                    </div>
                    <ErrorMessage
                      :id="`${id}-${row.key}-amount-error`"
                      :message="row.errors.amount"
                    />
                  </div>
                  <div class="min-w-0">
                    <label
                      :for="`${id}-${row.key}-description`"
                      class="mb-1 block text-caption sm:sr-only"
                      >Комментарий</label
                    >
                    <input
                      :id="`${id}-${row.key}-description`"
                      :value="row.description"
                      :readonly="saving"
                      aria-label="Комментарий"
                      type="text"
                      placeholder="Комментарий"
                      :title="row.description"
                      :class="[fieldClass, row.errors.description && 'border-danger']"
                      :aria-invalid="row.errors.description ? 'true' : undefined"
                      :aria-describedby="
                        row.errors.description ? `${id}-${row.key}-description-error` : undefined
                      "
                      @input="update(row, 'description', ($event.target as HTMLInputElement).value)"
                    />
                    <ErrorMessage
                      :id="`${id}-${row.key}-description-error`"
                      :message="row.errors.description"
                    />
                  </div>
                </div>
                <ErrorMessage class="mt-1" :message="row.message" />
              </div>
            </div>
            <BaseButton type="submit" class="mt-auto w-full shrink-0" :loading="saving"
              >Сохранить</BaseButton
            >
          </template>
        </form>
      </div>
    </div>
  </Teleport>
</template>
