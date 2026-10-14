<script setup lang="ts">
import { computed } from 'vue'

import {
  CATEGORY_NAME_CLASS,
  CATEGORY_NAME_MAX,
  COLUMN_CLASS,
  monthColumnClass,
  PINNED_Z,
  TOTAL_CLASS,
} from '@/components/budget/columns'
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

// Обрезанное название видно глазами, полное — в подсказке при наведении и для скринридера
const shortName = computed(() =>
  props.name.length > CATEGORY_NAME_MAX
    ? `${props.name.slice(0, CATEGORY_NAME_MAX).trimEnd()}…`
    : null,
)

const pinned = computed(() =>
  props.total
    ? { category: TOTAL_CLASS.pinned, plan: TOTAL_CLASS.pinned, average: TOTAL_CLASS.pinned }
    : PINNED_Z,
)
</script>

<template>
  <tr class="h-[34px]" :class="total && 'font-bold'">
    <th
      scope="row"
      :title="shortName ? name : undefined"
      :class="[COLUMN_CLASS.category, pinned.category, !total && 'font-medium']"
    >
      <span :class="CATEGORY_NAME_CLASS">
        <template v-if="shortName">
          <span aria-hidden="true">{{ shortName }}</span>
          <span class="sr-only">{{ name }}</span>
        </template>
        <template v-else>{{ name }}</template>
      </span>
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
