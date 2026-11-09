<script setup lang="ts">
import { useId } from 'vue'
import type { Category } from '@/types/category'
import { acceptAmount, type PlanDraft, type PlanErrors } from '@/plans/model'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'
const props = defineProps<{
  modelValue: PlanDraft
  categories: Category[]
  today: string
  errors: PlanErrors
  busy?: boolean
  actual?: boolean
  only?: keyof PlanDraft
}>()
const emit = defineEmits<{ 'update:modelValue': [draft: PlanDraft] }>()
const id = useId()
const fieldClass =
  'min-h-11 w-full min-w-0 rounded border border-field-border/50 bg-field px-3 py-2 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50'
/** Передаёт новый черновик, не мутируя исходные поля родителя. */
function update(field: keyof PlanDraft, event: Event) {
  const input = event.target as HTMLInputElement
  const value =
    field === 'amount' ? acceptAmount(props.modelValue.amount, input.value) : input.value
  if (field === 'amount' && value === props.modelValue.amount && input.value !== value) {
    input.value = value
    return
  }
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
/** Не допускает минус до появления символа в поле, включая вставку. */
function beforeAmount(event: InputEvent) {
  if (event.data && /[-−]/.test(event.data)) event.preventDefault()
}
/** Блокирует клавишу минуса независимо от раскладки цифрового блока. */
function keyAmount(event: KeyboardEvent) {
  if (event.key === '-' || event.key === '−') event.preventDefault()
}
/** Отвергает вставку отрицательного числа целиком. */
function pasteAmount(event: ClipboardEvent) {
  if (/[-−]/.test(event.clipboardData?.getData('text') ?? '')) event.preventDefault()
}
</script>
<template>
  <div class="grid min-w-0 gap-5" :class="!only && 'sm:grid-cols-2'">
    <div v-if="!only || only === 'amount'" class="min-w-0">
      <label :for="`${id}-amount`" class="mb-2 block text-sm text-ink-muted">{{
        actual ? 'Фактическая сумма, ₽' : 'Сумма, ₽'
      }}</label>
      <input
        :id="`${id}-amount`"
        :value="modelValue.amount"
        type="text"
        inputmode="numeric"
        :disabled="busy"
        :class="fieldClass"
        :aria-invalid="!!errors.amount"
        :aria-describedby="errors.amount ? `${id}-amount-error` : undefined"
        @input="update('amount', $event)"
        @beforeinput="beforeAmount"
        @keydown="keyAmount"
        @paste="pasteAmount"
      />
      <ErrorMessage :id="`${id}-amount-error`" :message="errors.amount" />
    </div>
    <div v-if="!only || only === 'date'" class="min-w-0">
      <label :for="`${id}-date`" class="mb-2 block text-sm text-ink-muted">{{
        actual ? 'Фактическая дата' : only ? 'Новая дата' : 'Дата'
      }}</label>
      <input
        :id="`${id}-date`"
        :value="modelValue.date"
        type="date"
        :min="actual ? '2000-01-01' : today"
        max="2099-12-31"
        :disabled="busy"
        :class="fieldClass"
        :aria-invalid="!!errors.date"
        :aria-describedby="errors.date ? `${id}-date-error` : undefined"
        @input="update('date', $event)"
      />
      <ErrorMessage :id="`${id}-date-error`" :message="errors.date" />
    </div>
    <div v-if="!only || only === 'category'" class="min-w-0" :class="!only && 'sm:col-span-2'">
      <label :for="`${id}-category`" class="mb-2 block text-sm text-ink-muted">Категория</label>
      <select
        :id="`${id}-category`"
        :value="modelValue.category"
        :disabled="busy"
        :class="fieldClass"
        :aria-invalid="!!errors.category"
        :aria-describedby="errors.category ? `${id}-category-error` : undefined"
        @change="update('category', $event)"
      >
        <option value="">Выберите категорию</option>
        <option v-for="category in categories" :key="category.uid" :value="category.uid">
          {{ category.category_type === 'income' ? '+' : '−' }} {{ category.name }}
        </option>
      </select>
      <ErrorMessage :id="`${id}-category-error`" :message="errors.category" />
    </div>
    <div v-if="!only || only === 'description'" class="min-w-0" :class="!only && 'sm:col-span-2'">
      <label :for="`${id}-description`" class="mb-2 block text-sm text-ink-muted"
        >Комментарий · необязательно</label
      >
      <textarea
        :id="`${id}-description`"
        :value="modelValue.description"
        rows="3"
        :disabled="busy"
        :class="fieldClass"
        :aria-invalid="!!errors.description"
        :aria-describedby="errors.description ? `${id}-description-error` : undefined"
        @input="update('description', $event)"
      />
      <ErrorMessage :id="`${id}-description-error`" :message="errors.description" />
    </div>
  </div>
</template>
