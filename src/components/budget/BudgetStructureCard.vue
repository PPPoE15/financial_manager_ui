<script setup lang="ts">
import { computed, ref } from 'vue'

import { MAX_YEAR, MIN_YEAR, useBudgetStructure } from '@/budget/useBudgetStructure'
import BudgetStructureTable from '@/components/budget/BudgetStructureTable.vue'
import CategoryEditorDialog from '@/components/categories/CategoryEditorDialog.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import type { TransactionType } from '@/types/budget'

// FM-58: «Новый дизайн», Главная 230:422, карточка 230:464 (Figma через браузер).
// Выбор года/типа и состояния без данных сохраняют согласованную адаптацию FM-28;
// контролы используют тему FM-55, отдельного макета этих состояний нет.
const { year, categoryType, data, loading, failed, reload } = useBudgetStructure()

// Окно «Редактирование категорий» (FM-42): открывается ссылкой в шапке карточки, как в макете;
// после создания статей таблица перезапрашивается.
const editorOpen = ref(false)

function openEditor(event: MouseEvent) {
  // Safari не фокусирует кнопку мышью: редактор должен запомнить именно кнопку открытия.
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus()
  editorOpen.value = true
}

const types: { value: TransactionType; label: string }[] = [
  { value: 'outcome', label: 'Расходы' },
  { value: 'income', label: 'Доходы' },
]

const emptyText = computed(() =>
  categoryType.value === 'income' ? 'Статей доходов пока нет' : 'Статей расходов пока нет',
)

// TODO(FM-28): классы стрелок года (размер, фон, фокус, disabled) повторяют вторичный вариант BaseButton —
// при смене его стиля разойдутся; вынести общие классы или дать BaseButton размер «квадратная иконка».
const controlFocus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'
</script>

<template>
  <section
    aria-labelledby="budget-structure-title"
    class="min-w-0 rounded bg-budget-panel/40 px-3 pb-5 pt-4 shadow-panel"
  >
    <div class="flex flex-wrap items-start justify-between gap-4 px-2">
      <div>
        <h2 id="budget-structure-title" class="text-lg font-bold">Мои категории</h2>
        <p class="mt-1 text-caption text-ink-muted">Структура бюджета</p>
      </div>

      <!-- «Редактировать категории» в макете — подпись 12px в правом верхнем углу карточки;
             по смыслу это кнопка: открывает окно, а не переходит на страницу -->
      <button
        type="button"
        class="min-h-control rounded px-1 text-caption text-ink-secondary hover:text-ink"
        :class="controlFocus"
        @click="openEditor"
      >
        Редактировать категории
      </button>
      <div class="flex w-full flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Тип статей"
          class="grid min-h-control grid-cols-2 rounded bg-field p-1"
        >
          <button
            v-for="type in types"
            :key="type.value"
            type="button"
            :aria-pressed="categoryType === type.value ? 'true' : 'false'"
            class="min-h-control rounded px-4 text-caption transition-colors"
            :class="[
              controlFocus,
              categoryType === type.value
                ? 'bg-action font-bold text-action-foreground'
                : 'font-medium text-ink-secondary hover:bg-field-hover hover:text-ink',
            ]"
            @click="categoryType = type.value"
          >
            {{ type.label }}
          </button>
        </div>

        <div role="group" aria-label="Год" class="flex items-center gap-[6px]">
          <button
            type="button"
            aria-label="Предыдущий год"
            :disabled="year <= MIN_YEAR"
            class="size-[38px] rounded bg-field text-lg text-ink enabled:hover:bg-field-hover enabled:active:bg-surface-muted disabled:cursor-not-allowed disabled:bg-action-disabled disabled:text-action-disabled-foreground"
            :class="controlFocus"
            @click="year--"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <span
            data-testid="budget-year"
            aria-live="polite"
            class="min-w-[48px] text-center text-caption font-semibold tabular-nums text-ink"
            >{{ year }}</span
          >
          <button
            type="button"
            aria-label="Следующий год"
            :disabled="year >= MAX_YEAR"
            class="size-[38px] rounded bg-field text-lg text-ink enabled:hover:bg-field-hover enabled:active:bg-surface-muted disabled:cursor-not-allowed disabled:bg-action-disabled disabled:text-action-disabled-foreground"
            :class="controlFocus"
            @click="year++"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>
    </div>

    <div class="mt-6 min-h-[250px]">
      <!-- TODO(FM-28): при смене года/типа таблица заменяется на «Загрузка…» — прокрутка к декабрю сбрасывается. Показывать заглушку только при `loading && !data`, при
           перезапросе оставлять прежнюю таблицу приглушённой.
           TODO(FM-28): role="status" появляется сразу с текстом — скринридеры такой live-регион часто не
           объявляют; держать постоянный контейнер статуса и менять только текст. -->
      <p v-if="loading" role="status" class="px-3 py-10 text-center text-sm text-ink-muted">
        Загрузка…
      </p>
      <div v-else-if="failed" class="flex flex-col items-center gap-4 px-3 py-10 text-center">
        <ErrorMessage message="Не удалось загрузить структуру бюджета" />
        <BaseButton variant="secondary" @click="reload">Повторить</BaseButton>
      </div>
      <p
        v-else-if="data && data.rows.length === 0"
        class="px-3 py-10 text-center text-sm text-ink-muted"
      >
        {{ emptyText }}
      </p>
      <BudgetStructureTable v-else-if="data" :data="data" />
    </div>

    <CategoryEditorDialog v-if="editorOpen" @saved="reload" @close="editorOpen = false" />
  </section>
</template>
