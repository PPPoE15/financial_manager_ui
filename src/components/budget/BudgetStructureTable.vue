<script setup lang="ts">
import BudgetStructureLine from '@/components/budget/BudgetStructureLine.vue'
import {
  COLUMN_CLASS,
  MONTH_NAMES,
  LAYER_CLASS,
  monthColumnClass,
} from '@/components/budget/columns'
import type { BudgetStructure } from '@/types/budget'

// Таблица «Структура бюджета» по макету Figma «Новый дизайн» (Главная 230:422, группа «Колонки», 499px по высоте). В карточке
// 863px видны «Категория», «План», «Среднее» и три месяца — остальные месяцы прокручиваются по горизонтали
// внутри обёртки (закреплённые колонки — в columns.ts). По высоте (FM-43): не ниже половины макета (250px,
// при малом числе статей под строками остаётся пустое место) и не выше макета (500px) — дальше статьи
// прокручиваются по вертикали, а «Сумма» прилипает к низу.
// NOTE(FM-58): поверхность прокрутки и закреплённые ячейки непрозрачны: месяцы и строки
// не просвечивают друг через друга при горизонтальной/вертикальной прокрутке (FM-43).
// TODO(FM-28): в макете «Среднее» и перерасход месяца раскрашены относительно плана (зелёный /
// жёлтый / красный) — это сравнение плана и факта, отдельная история этапа 2; пока суммы без цвета.
defineProps<{ data: BudgetStructure }>()
</script>

<template>
  <!-- relative: иначе sr-only подписи (absolute) скрытых за прокруткой месяцев расширяют всю страницу
       TODO(FM-43): при 2–3 статьях горизонтальная полоса прокрутки — внизу 250px-блока, оторвана от таблицы:
       min-h ставить на внешний блок, а overflow — на внутренний.
       FM-58: область фокусируется с клавиатуры, стрелки прокручивают месяцы и статьи. -->
  <div
    data-testid="budget-table-scroll"
    tabindex="0"
    role="region"
    aria-label="Структура бюджета по месяцам"
    class="relative max-h-[500px] min-h-[250px] overflow-auto rounded bg-surface-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
  >
    <table
      class="w-max border-separate border-spacing-0 whitespace-nowrap text-center font-sans text-caption font-medium tabular-nums tracking-normal text-ink"
    >
      <thead class="text-sm font-semibold text-ink">
        <tr>
          <th
            scope="col"
            class="h-9 border-b border-ink/30 align-top"
            :class="[COLUMN_CLASS.category, LAYER_CLASS.row.category]"
          >
            Категория
          </th>
          <th
            scope="col"
            class="h-9 border-b border-ink/30 align-top"
            :class="[COLUMN_CLASS.plan, LAYER_CLASS.row.plan]"
          >
            План
          </th>
          <th
            scope="col"
            class="h-9 border-b border-ink/30 align-top"
            :class="[COLUMN_CLASS.average, LAYER_CLASS.row.average]"
          >
            Среднее
          </th>
          <th
            v-for="(month, index) in MONTH_NAMES"
            :key="month"
            scope="col"
            class="h-9 border-b border-ink/30 align-top"
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
