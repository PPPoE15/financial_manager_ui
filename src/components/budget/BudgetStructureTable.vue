<script setup lang="ts">
import BudgetStructureLine from '@/components/budget/BudgetStructureLine.vue'
import { COLUMN_CLASS, MONTH_NAMES, monthColumnClass } from '@/components/budget/columns'
import type { BudgetStructure } from '@/types/budget'

// Таблица «Структура бюджета» по макету Figma Frame 8 (узел 116:134 «Колонки»). В карточке 863px
// видны «Категория», «План», «Среднее» и три месяца — остальные месяцы (и всё на узком экране)
// прокручиваются по горизонтали внутри обёртки, «Категория» закреплена (узкого макета нет, FM-28).
// TODO(FM-28): в макете «Среднее» и перерасход месяца раскрашены относительно плана (зелёный /
// жёлтый / красный) — это сравнение плана и факта, отдельная история этапа 2; пока суммы без цвета.
defineProps<{ data: BudgetStructure }>()
</script>

<template>
  <!-- relative: иначе sr-only подписи (absolute) скрытых за прокруткой месяцев расширяют всю страницу -->
  <div data-testid="budget-table-scroll" class="relative overflow-x-auto">
    <table
      class="w-max border-separate border-spacing-0 whitespace-nowrap text-center font-brand text-sm font-medium tracking-normal text-ink-secondary"
    >
      <thead class="text-base font-bold text-primary">
        <tr>
          <th scope="col" class="h-8 align-top" :class="COLUMN_CLASS.category">Категория</th>
          <th scope="col" class="h-8 align-top" :class="COLUMN_CLASS.plan">План</th>
          <th scope="col" class="h-8 align-top" :class="COLUMN_CLASS.average">Среднее</th>
          <th
            v-for="(month, index) in MONTH_NAMES"
            :key="month"
            scope="col"
            class="h-8 align-top"
            :class="monthColumnClass(index)"
          >
            {{ month }}
          </th>
        </tr>
      </thead>
      <tbody>
        <BudgetStructureLine
          v-for="row in data.rows"
          :key="row.category.uid"
          :name="row.category.name"
          :plan="row.money_plan"
          :average="row.average"
          :months="row.months"
        />
      </tbody>
      <tfoot>
        <BudgetStructureLine
          name="сумма"
          :plan="data.total.money_plan"
          :average="data.total.average"
          :months="data.total.months"
        />
      </tfoot>
    </table>
  </div>
</template>
