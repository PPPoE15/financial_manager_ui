<script setup lang="ts">
import { useId } from 'vue'
import BalanceHistoryChart from './BalanceHistoryChart.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import { useBalanceHistory } from '@/balanceHistory/useBalanceHistory'

const emit = defineEmits<{ 'set-balance': [] }>()
const id = useId()
const { from, to, points, loading, error, validation, needsBalance, today, unknown, reload } =
  useBalanceHistory()
defineExpose({ reload })
</script>

<template>
  <!-- FM-88: Figma 847:3. Состояния и адаптив согласованы в стиле существующих карточек. -->
  <section
    :aria-labelledby="`${id}-title`"
    class="min-w-0 rounded bg-budget-panel/40 p-4 shadow-panel"
  >
    <header class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 :id="`${id}-title`" class="text-base font-bold">Динамика финансов</h2>
      <div class="flex min-w-0 flex-wrap gap-3 text-caption text-ink-muted">
        <label class="flex min-w-0 items-center gap-2" :for="`${id}-from`"
          >От
          <input
            :id="`${id}-from`"
            v-model="from"
            type="date"
            min="2000-01-01"
            :max="today"
            :aria-invalid="!!validation"
            :aria-describedby="validation ? `${id}-validation` : undefined"
            class="h-8 min-w-0 w-[132px] rounded border border-field-border bg-field px-2 text-caption text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          />
        </label>
        <label class="flex min-w-0 items-center gap-2" :for="`${id}-to`"
          >До
          <input
            :id="`${id}-to`"
            v-model="to"
            type="date"
            min="2000-01-01"
            :max="today"
            :aria-invalid="!!validation"
            :aria-describedby="validation ? `${id}-validation` : undefined"
            class="h-8 min-w-0 w-[132px] rounded border border-field-border bg-field px-2 text-caption text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          />
        </label>
      </div>
    </header>
    <div class="min-h-[220px]">
      <ErrorMessage v-if="validation" :id="`${id}-validation`" :message="validation" />
      <p v-else-if="loading" role="status" class="py-10 text-center text-sm text-ink-muted">
        Загрузка…
      </p>
      <div v-else-if="needsBalance" class="flex flex-col items-start gap-3 py-6">
        <p class="text-sm">Для отображения графика задайте стартовый остаток</p>
        <BaseButton variant="secondary" @click="emit('set-balance')"
          >Задать стартовый остаток</BaseButton
        >
      </div>
      <div v-else-if="error" class="flex flex-col items-start gap-3 py-6">
        <ErrorMessage :message="error" />
        <BaseButton variant="secondary" @click="reload">Повторить</BaseButton>
      </div>
      <p v-else-if="unknown" role="status" class="py-10 text-sm text-ink-muted">
        Остаток за выбранный период неизвестен. Выберите даты начиная с даты стартового остатка.
      </p>
      <BalanceHistoryChart v-else-if="points.length" :points="points" />
    </div>
  </section>
</template>
