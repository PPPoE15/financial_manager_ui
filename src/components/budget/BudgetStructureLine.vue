<script setup lang="ts">
import { computed } from 'vue'

import { COLUMN_CLASS, monthColumnClass, PINNED_Z, TOTAL_CLASS } from '@/components/budget/columns'
import MoneyCell from '@/components/budget/MoneyCell.vue'
import type { MonthFact } from '@/types/budget'

// Строка таблицы — статья или итог «Сумма». Итог жирный и прилипает к низу прокрутки — отклонение
// от макета по просьбе заказчика (FM-43): в макете «сумма» строчными и выглядит как строка статьи.
const props = defineProps<{
  name: string
  plan: number | null
  average: number | null
  months: MonthFact[]
  total?: boolean
}>()

const pinned = computed(() =>
  props.total
    ? { category: TOTAL_CLASS.pinned, plan: TOTAL_CLASS.pinned, average: TOTAL_CLASS.pinned }
    : PINNED_Z,
)
</script>

<template>
  <tr class="h-[34px]" :class="total && 'font-bold'">
    <th scope="row" :class="[COLUMN_CLASS.category, pinned.category, !total && 'font-medium']">
      {{ name }}
    </th>
    <MoneyCell
      :value="plan"
      missing-label="план не задан"
      :class="[COLUMN_CLASS.plan, pinned.plan]"
    />
    <MoneyCell
      :value="average"
      missing-label="нет завершённых месяцев"
      :class="[COLUMN_CLASS.average, pinned.average]"
    />
    <!-- TODO(FM-28): месяц берётся по позиции в `months`, а не по `month`; контракт обещает январь–декабрь
         по порядку — сверить с реализацией FM-27 при приёмке или искать ячейку по номеру месяца. -->
    <MoneyCell
      v-for="(month, index) in months"
      :key="month.month"
      :value="month.fact"
      missing-label="месяц ещё не наступил"
      :class="[monthColumnClass(index), total && TOTAL_CLASS.month]"
    />
  </tr>
</template>
