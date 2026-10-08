<script setup lang="ts">
import { computed } from 'vue'

import { MAX_YEAR, MIN_YEAR, useBudgetStructure } from '@/budget/useBudgetStructure'
import BudgetStructureTable from '@/components/budget/BudgetStructureTable.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import type { TransactionType } from '@/types/budget'

// Карточка «Мои категории — Структура бюджета» по макету Figma Frame 8 (узлы 116:125, 116:127, 116:129).
// Выбора года и типа статей, состояний загрузки, ошибки и пустого в макете нет — согласованное
// отклонение (FM-28): переключатель «Расходы / Доходы» в стиле вкладок экрана входа и год стрелками
// в стиле вторичной кнопки макета, на месте «Добавить» (кнопка — в задаче создания статьи).
const { year, categoryType, data, loading, failed, reload } = useBudgetStructure()

const types: { value: TransactionType; label: string }[] = [
  { value: 'outcome', label: 'Расходы' },
  { value: 'income', label: 'Доходы' },
]

const emptyText = computed(() =>
  categoryType.value === 'income' ? 'Статей доходов пока нет' : 'Статей расходов пока нет',
)

const controlFocus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
</script>

<template>
  <section
    aria-labelledby="budget-structure-title"
    class="rounded bg-surface-card px-3 pb-[27px] pt-4"
  >
    <div class="flex flex-wrap items-start justify-between gap-3 px-3">
      <div>
        <h2 id="budget-structure-title" class="text-base font-bold">Мои категории</h2>
        <p class="mt-1 text-caption text-ink-muted">Структура бюджета</p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Тип статей"
          class="grid h-[42px] grid-cols-2 gap-[6px] rounded bg-surface-muted p-[3px]"
        >
          <button
            v-for="type in types"
            :key="type.value"
            type="button"
            :aria-pressed="categoryType === type.value ? 'true' : 'false'"
            class="rounded-md px-4 text-sm"
            :class="[
              controlFocus,
              categoryType === type.value
                ? 'bg-surface-card font-bold text-primary'
                : 'font-medium text-ink-muted hover:text-primary',
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
            class="size-[42px] rounded-sm bg-primary-soft text-base font-bold text-primary disabled:cursor-not-allowed disabled:opacity-50"
            :class="controlFocus"
            @click="year--"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <span
            data-testid="budget-year"
            aria-live="polite"
            class="min-w-[48px] text-center text-sm font-bold text-primary"
            >{{ year }}</span
          >
          <button
            type="button"
            aria-label="Следующий год"
            :disabled="year >= MAX_YEAR"
            class="size-[42px] rounded-sm bg-primary-soft text-base font-bold text-primary disabled:cursor-not-allowed disabled:opacity-50"
            :class="controlFocus"
            @click="year++"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>
    </div>

    <div class="mt-9">
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
  </section>
</template>
