<script setup lang="ts">
import { useId } from 'vue'

import CategoryRow from '@/components/categories/CategoryRow.vue'
import type { EditorColumn, EditorRow, RowField } from '@/categories/useCategoryEditor'

// Колонка «Расходы» / «Доходы» окна «Редактирование категорий» (макет «Новый дизайн», узлы 234:962 и
// 237:1084): существующие статьи и пустые строки для новых — одинаковыми строками из трёх полей (название 184px,
// план 185px, комментарий 292px, между ячейками 5px, между строками 4px). Существующие статьи правятся в тех же
// полях (FM-46); у пустого комментария — бледная подсказка «Комментарий», как в макете.
defineProps<{
  column: EditorColumn
  title: string
  emptyText: string
  /** Цвет заголовка: расходы — красный, доходы — зелёный, как в макете. */
  tone: 'danger' | 'success'
  /** Все строки только для чтения (идёт сохранение). */
  readonly?: boolean
}>()

defineEmits<{ update: [row: EditorRow, field: RowField, value: string] }>()

const headingId = useId()
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
      <li v-for="row in column.categories" :key="row.key">
        <CategoryRow
          data-testid="category-row"
          :row="row"
          :readonly="readonly"
          @update="(field, value) => $emit('update', row, field, value)"
        />
      </li>
    </ul>

    <div
      class="flex flex-col gap-3 sm:gap-1"
      :class="column.categories.length === 0 ? 'mt-4' : 'mt-3 sm:mt-1'"
    >
      <CategoryRow
        v-for="row in column.rows"
        :key="row.key"
        data-testid="new-row"
        :row="row"
        :readonly="readonly"
        @update="(field, value) => $emit('update', row, field, value)"
      />
    </div>
  </section>
</template>
