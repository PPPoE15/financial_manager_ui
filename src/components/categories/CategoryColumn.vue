<script setup lang="ts">
import { useId } from 'vue'

import CategoryNewRow from '@/components/categories/CategoryNewRow.vue'
import type { EditorColumn, NewRow, NewRowField } from '@/categories/useCategoryEditor'
import { formatMoney } from '@/utils/money'

// Колонка «Расходы» / «Доходы» окна «Редактирование категорий» (макет «Новый дизайн», узлы 234:962 и
// 237:1084): существующие статьи строками из трёх ячеек — название 184px, план 185px, комментарий 292px,
// между ячейками 5px, между строками 4px — и пустые строки для новых статей. Существующие статьи
// только для чтения: их изменение — FM-4.
defineProps<{
  column: EditorColumn
  title: string
  emptyText: string
  /** Цвет заголовка: расходы — красный, доходы — зелёный, как в макете. */
  tone: 'danger' | 'success'
  /** Строки для новых статей только для чтения (идёт сохранение). */
  readonly?: boolean
}>()

defineEmits<{ update: [row: NewRow, field: NewRowField, value: string] }>()

const headingId = useId()

/** Сумма без знака рубля: знак выводится отдельно у края ячейки. */
function amount(value: number): string {
  return formatMoney(value).replace(/\s₽$/, '')
}

const cell = 'flex h-[46px] min-w-0 items-center rounded-sm bg-surface px-[15px] text-sm text-ink'
</script>

<template>
  <section :aria-labelledby="headingId" class="min-w-0">
    <h3
      :id="headingId"
      class="text-center text-lg font-bold"
      :class="tone === 'danger' ? 'text-danger' : 'text-success'"
    >
      {{ title }}
    </h3>

    <p v-if="column.categories.length === 0" class="mt-4 text-center text-sm text-ink-muted">
      {{ emptyText }}
    </p>
    <!-- На узком экране строка статьи — две линии (название, затем план и комментарий): между статьями
         зазор 12px, чтобы их не путать; от sm — одна линия и зазор 4px из макета -->
    <ul
      v-else
      class="mt-[15px] flex flex-col gap-3 sm:gap-1"
      :aria-label="`Статьи: ${title.toLowerCase()}`"
    >
      <li
        v-for="category in column.categories"
        :key="category.uid"
        data-testid="category-row"
        class="grid grid-cols-2 gap-[5px] sm:grid-cols-[184fr_185fr_292fr]"
      >
        <span data-testid="cell" :class="[cell, 'col-span-2 font-medium sm:col-span-1']">
          <span class="truncate" :title="category.name">{{ category.name }}</span>
        </span>
        <span data-testid="cell" :class="[cell, 'justify-between font-medium']">
          <!-- Как в макете: сумма слева, знак ₽ у правого края ячейки -->
          <template v-if="category.money_plan !== null">
            <span>{{ amount(category.money_plan) }}&nbsp;</span><span>₽</span>
          </template>
          <span v-else class="sr-only">план не задан</span>
        </span>
        <span data-testid="cell" :class="cell">
          <span v-if="category.description" class="truncate" :title="category.description">{{
            category.description
          }}</span>
        </span>
      </li>
    </ul>

    <div
      class="flex flex-col gap-3 sm:gap-1"
      :class="column.categories.length === 0 ? 'mt-4' : 'mt-3 sm:mt-1'"
    >
      <CategoryNewRow
        v-for="row in column.rows"
        :key="row.key"
        :row="row"
        :readonly="readonly"
        @update="(field, value) => $emit('update', row, field, value)"
      />
    </div>
  </section>
</template>
