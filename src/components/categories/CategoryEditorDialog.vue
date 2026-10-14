<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'

import CategoryColumn from '@/components/categories/CategoryColumn.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import { useCategoryEditor } from '@/categories/useCategoryEditor'

// Окно «Редактирование категорий» по макету «Новый дизайн» (фрейм 234:734, окно 234:954; геометрия —
// из метаданных узла: окно 1535×672, поля 65px, колонки по 670px с зазором 65px, кнопка 671px по центру).
// Цвета — текущей темы приложения, как в «Первом шаге» (FM-39): переход на новый дизайн не входит в задачу.
// Отклонение от макета: кнопка «Сохранить» высотой 50px (h-control, как все основные кнопки приложения),
// а не 38px. Окно открывается поверх главной, закрывается крестиком и Escape, фокус удерживается внутри.
const emit = defineEmits<{
  /** Создана хотя бы одна статья — таблицу «Структура бюджета» нужно перезапросить. */
  saved: []
  close: []
}>()

const { columns, loading, loadFailed, message, saving, load, save, updateRow } = useCategoryEditor()

const titleId = useId()
const panel = ref<HTMLElement | null>(null)
// Элемент, с которого открыли окно (ссылка «Редактировать категории»): после закрытия фокус вернётся на него
const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null

const FOCUSABLE = 'input:not([disabled]), button:not([disabled])'

// TODO(FM-42): удержание фокуса и inert на #app повторяют FirstStepDialog — вынести общий BaseDialog.
function focusables(): HTMLElement[] {
  return panel.value ? [...panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)] : []
}

function keepFocusInside(): void {
  if (panel.value && !panel.value.contains(document.activeElement)) focusables()[0]?.focus()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    // Во время сохранения окно не закрывается: родитель снимет его через v-if, и «saved» после
    // ответа уже не дойдёт — таблица «Структура бюджета» не узнает о созданных статьях
    if (!saving.value) emit('close')
    return
  }
  if (event.key !== 'Tab') return

  const items = focusables()
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

// Приложение под окном недоступно ни мыши, ни клавиатуре, ни скринридеру; окно вынесено в body,
// поэтому inert на #app его не задевает.
function setAppInert(value: boolean): void {
  document.getElementById('app')?.toggleAttribute('inert', value)
}

async function onLoad(): Promise<void> {
  await load()
  await nextTick()
  keepFocusInside()
}

async function onSubmit(): Promise<void> {
  const result = await save()
  if (result?.saved) emit('saved')
  if (result?.complete) {
    emit('close')
    return
  }
  // Окно остаётся открытым: строка с фокусом могла сохраниться и уйти из DOM, а кнопка на время запроса
  // становилась disabled — без фокуса внутри панели не работают Escape и удержание Tab
  // TODO(FM-42): ставить фокус в первое поле с ошибкой, а не в первый элемент окна (крестик).
  await nextTick()
  keepFocusInside()
}

onMounted(async () => {
  setAppInert(true)
  await nextTick()
  keepFocusInside()
  await onLoad()
})

onBeforeUnmount(() => {
  setAppInert(false)
  opener?.focus()
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-8 font-sans text-ink backdrop-blur-sm sm:items-center"
    >
      <div
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        class="relative w-full max-w-[1535px] rounded bg-surface-card px-4 pb-6 pt-8 shadow-xl sm:px-[65px] sm:pb-[27px] sm:pt-[46px]"
        @keydown="onKeydown"
      >
        <button
          type="button"
          aria-label="Закрыть"
          :disabled="saving"
          class="absolute right-3 top-3 flex size-10 items-center justify-center rounded-sm text-ink-muted hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 sm:right-[14px] sm:top-[14px]"
          @click="emit('close')"
        >
          <!-- Крестик 12×12 из макета (узел 235:1004) -->
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </button>

        <h2 :id="titleId" class="pr-10 text-xl font-bold text-primary sm:text-2xl">
          Редактирование категорий
        </h2>

        <p v-if="loading" role="status" class="py-16 text-center text-sm text-ink-muted">
          Загрузка…
        </p>
        <div v-else-if="loadFailed" class="flex flex-col items-center gap-4 py-16 text-center">
          <ErrorMessage message="Не удалось загрузить статьи" />
          <BaseButton variant="secondary" @click="onLoad">Повторить</BaseButton>
        </div>
        <!-- novalidate: проверку делаем сами и показываем свои сообщения -->
        <form
          v-else
          class="mt-8 flex flex-col gap-8 sm:mt-[31px] lg:min-h-[521px]"
          novalidate
          @submit.prevent="onSubmit"
        >
          <div class="grid gap-8 lg:grid-cols-2 lg:gap-[65px]">
            <CategoryColumn
              :column="columns.outcome"
              title="Расходы"
              empty-text="Статей расходов пока нет"
              tone="danger"
              :readonly="saving"
              @update="updateRow"
            />
            <CategoryColumn
              :column="columns.income"
              title="Доходы"
              empty-text="Статей доходов пока нет"
              tone="success"
              :readonly="saving"
              @update="updateRow"
            />
          </div>
          <div class="mx-auto mt-auto flex w-full max-w-[671px] flex-col gap-3">
            <ErrorMessage data-testid="form-error" :message="message" />
            <BaseButton type="submit" class="w-full" :loading="saving">Сохранить</BaseButton>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
