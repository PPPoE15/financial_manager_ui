<script setup lang="ts">
import { ref } from 'vue'
import type { Category } from '@/types/category'
import { validEditorDate } from '@/transactions/editorModel'
import { formatMoney } from '@/utils/money'
const props = defineProps<{
  mode: 'date' | 'category' | 'delete'
  count: number
  sum: number
  categories: Category[]
  hasDrafts: boolean
  busy: boolean
}>()
const emit = defineEmits<{ cancel: []; apply: [value: string] }>()
const value = ref(''),
  error = ref('')
/** Проверяет массовое значение перед применением к черновикам. */
function apply() {
  if (props.busy) return
  if (props.mode === 'date' && !validEditorDate(value.value)) {
    error.value = 'Выберите дату с 2000 по 2099 год'
    return
  }
  if (
    props.mode === 'category' &&
    !props.categories.some(
      /** Проверяет принадлежность категории доступному списку. */ (c) => c.uid === value.value,
    )
  ) {
    error.value = 'Выберите категорию'
    return
  }
  emit('apply', value.value)
}
</script>
<template>
  <section
    data-editor-dialog
    role="dialog"
    aria-modal="true"
    aria-labelledby="bulk-title"
    tabindex="-1"
    class="w-full max-w-md rounded-md bg-gradient-to-r from-dialog-start to-dialog-end p-6 shadow-xl"
  >
    <h2 id="bulk-title" class="text-lg font-medium">
      {{
        mode === 'date'
          ? 'Изменить дату'
          : mode === 'category'
            ? 'Изменить категорию'
            : `Удалить ${count} операций?`
      }}
    </h2>
    <p class="mt-2 text-caption text-ink-muted">Выбрано операций: {{ count }}</p>
    <template v-if="mode === 'delete'"
      ><p class="mt-4">Общая сумма: {{ formatMoney(sum) }}</p>
      <p class="mt-3 text-sm">
        Операции будут удалены из списка и расчётов. Отменить удаление нельзя.
      </p>
      <p v-if="hasDrafts" class="mt-2 text-sm">
        Несохранённые правки удалённых строк также будут потеряны.
      </p></template
    >
    <label v-else class="mt-5 block text-caption"
      >{{ mode === 'date' ? 'Новая дата' : 'Новая категория' }}
      <input
        v-if="mode === 'date'"
        v-model="value"
        type="date"
        min="2000-01-01"
        max="2099-12-31"
        :disabled="busy"
        class="mt-2 min-h-control w-full rounded bg-field px-3 text-base"
      />
      <select
        v-else
        v-model="value"
        :disabled="busy"
        class="mt-2 min-h-control w-full rounded bg-field px-3 text-base"
      >
        <option value="">Выберите категорию</option>
        <option v-for="c in categories" :key="c.uid" :value="c.uid">{{ c.name }}</option>
      </select>
    </label>
    <p v-if="mode !== 'delete'" class="mt-3 text-caption text-ink-muted">
      Строки получат отметку несохранённых изменений.
    </p>
    <p v-if="error" role="alert" class="mt-2 text-sm text-danger">{{ error }}</p>
    <footer class="mt-6 flex flex-wrap justify-end gap-3">
      <button
        type="button"
        :disabled="busy"
        class="min-h-control rounded bg-field px-4 focus-visible:outline"
        @click="emit('cancel')"
      >
        Отмена</button
      ><button
        type="button"
        :disabled="busy"
        :class="
          mode === 'delete' ? 'bg-destructive text-white' : 'bg-action text-action-foreground'
        "
        class="min-h-control rounded px-4 font-medium focus-visible:outline disabled:opacity-50"
        @click="apply"
      >
        {{ mode === 'delete' ? `Удалить ${count}` : `Применить к ${count}` }}
      </button>
    </footer>
  </section>
</template>
