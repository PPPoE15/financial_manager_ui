<script setup lang="ts">
import { COLUMN_CLASS, monthColumnClass } from '@/components/budget/columns'
import MoneyCell from '@/components/budget/MoneyCell.vue'
import type { MonthFact } from '@/types/budget'

// Строка таблицы — статья или итог «сумма» (в макете они выглядят одинаково)
defineProps<{
  name: string
  plan: number | null
  average: number | null
  months: MonthFact[]
}>()
</script>

<template>
  <tr class="h-[34px]">
    <th scope="row" class="font-medium" :class="COLUMN_CLASS.category">{{ name }}</th>
    <MoneyCell :value="plan" missing-label="план не задан" :class="COLUMN_CLASS.plan" />
    <MoneyCell
      :value="average"
      missing-label="нет завершённых месяцев"
      :class="COLUMN_CLASS.average"
    />
    <!-- TODO(FM-28): месяц берётся по позиции в `months`, а не по `month`; контракт обещает январь–декабрь
         по порядку — сверить с реализацией FM-27 при приёмке или искать ячейку по номеру месяца. -->
    <MoneyCell
      v-for="(month, index) in months"
      :key="month.month"
      :value="month.fact"
      missing-label="месяц ещё не наступил"
      :class="monthColumnClass(index)"
    />
  </tr>
</template>
