<script setup lang="ts">
import BudgetStructureLine from '@/components/budget/BudgetStructureLine.vue'
import {
  COLUMN_CLASS,
  MONTH_NAMES,
  LAYER_CLASS,
  monthColumnClass,
} from '@/components/budget/columns'
import type { BudgetStructure } from '@/types/budget'

// Таблица «Структура бюджета» по макету Figma Frame 8 (узел 116:134 «Колонки», 500px по высоте). В карточке
// 863px видны «Категория», «План», «Среднее» и три месяца — остальные месяцы прокручиваются по горизонтали
// внутри обёртки (закреплённые колонки — в columns.ts). По высоте (FM-43): не ниже половины макета (250px,
// при малом числе статей под строками остаётся пустое место) и не выше макета (500px) — дальше статьи
// прокручиваются по вертикали, а «Сумма» прилипает к низу.
// TODO(FM-28): в макете «Среднее» и перерасход месяца раскрашены относительно плана (зелёный /
// жёлтый / красный) — это сравнение плана и факта, отдельная история этапа 2; пока суммы без цвета.
defineProps<{ data: BudgetStructure }>()
</script>

<template>
  <!-- relative: иначе sr-only подписи (absolute) скрытых за прокруткой месяцев расширяют всю страницу
       TODO(FM-43): при 2–3 статьях горизонтальная полоса прокрутки — внизу 250px-блока, оторвана от таблицы:
       min-h ставить на внешний блок, а overflow — на внутренний.
       TODO(FM-43): у области прокрутки нет tabindex="0", role="region" и aria-label — в Safari с клавиатуры
       не прокрутить ни месяцы, ни статьи ниже 500px. -->
  <div data-testid="budget-table-scroll" class="relative max-h-[500px] min-h-[250px] overflow-auto">
    <table
      class="w-max border-separate border-spacing-0 whitespace-nowrap text-center font-brand text-sm font-medium tracking-normal text-ink-secondary"
    >
      <thead class="text-base font-bold text-primary">
        <tr>
          <th
            scope="col"
            class="h-8 align-top"
            :class="[COLUMN_CLASS.category, LAYER_CLASS.row.category]"
          >
            Категория
          </th>
          <th scope="col" class="h-8 align-top" :class="[COLUMN_CLASS.plan, LAYER_CLASS.row.plan]">
            План
          </th>
          <th
            scope="col"
            class="h-8 align-top"
            :class="[COLUMN_CLASS.average, LAYER_CLASS.row.average]"
          >
            Среднее
          </th>
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
          name="Сумма"
          total
          :plan="data.total.money_plan"
          :average="data.total.average"
          :months="data.total.months"
        />
      </tfoot>
    </table>
  </div>
</template>
