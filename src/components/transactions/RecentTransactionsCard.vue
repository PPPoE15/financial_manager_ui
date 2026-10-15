<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { listTransactions } from '@/api/transactions'
import BaseButton from '@/components/ui/BaseButton.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import type { TransactionType } from '@/types/budget'
import type { Transaction } from '@/types/transaction'
import { formatMoney } from '@/utils/money'

const props = defineProps<{ type: TransactionType }>()
const emit = defineEmits<{ add: [type: TransactionType] }>()
function add(event: MouseEvent) {
  // Safari не фокусирует кнопку при клике: окно должно вернуть фокус именно сюда.
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus()
  emit('add', props.type)
}
const titleId = useId()
const income = computed(() => props.type === 'income')
const records = ref<Transaction[]>([])
const loading = ref(false)
const failed = ref(false)
let latestRequest = 0

async function reload(): Promise<void> {
  const request = ++latestRequest
  loading.value = true
  failed.value = false
  try {
    const result = await listTransactions(props.type)
    if (request === latestRequest) records.value = result
  } catch {
    if (request === latestRequest) {
      records.value = []
      failed.value = true
    }
  } finally {
    if (request === latestRequest) loading.value = false
  }
}

// Контракт отдаёт локальную дату-время без зоны: не конвертируем через UTC/часовой пояс браузера.
function formatDate(value: string): string {
  return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}`
}

watch(() => props.type, reload, { immediate: true })
onBeforeUnmount(() => {
  latestRequest++
})
// Окно ввода сможет вызвать reload() через template ref после сохранения.
defineExpose({ reload })
</script>

<template>
  <!-- FM-50: Figma Главная 230:422, фон 230:588 (010D17, 40%). Строки — адаптация
       таблицы «Мои категории»: в макете карточка пустая; снимки для согласования — в PR. -->
  <section :aria-labelledby="titleId" class="min-w-0 rounded bg-budget-panel/40 p-4 shadow-panel">
    <header class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <h2 :id="titleId" class="text-base font-bold">{{ income ? 'Доходы' : 'Расходы' }}</h2>
        <p class="mt-1 text-caption text-ink-muted">Недавно добавленные записи</p>
      </div>
      <button
        type="button"
        :aria-label="income ? 'Добавить доход' : 'Добавить расход'"
        class="flex size-[38px] shrink-0 items-center justify-center rounded text-xl text-ink-secondary hover:bg-field-hover hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        @click="add"
      >
        <span aria-hidden="true">+</span>
      </button>
    </header>
    <div class="mt-4 min-h-[250px]">
      <p role="status" :class="loading ? 'py-10 text-center text-sm text-ink-muted' : 'sr-only'">
        {{ loading ? 'Загрузка…' : '' }}
      </p>
      <template v-if="!loading">
        <div v-if="failed" class="flex flex-col items-center gap-4 py-10 text-center">
          <ErrorMessage
            :message="income ? 'Не удалось загрузить доходы' : 'Не удалось загрузить расходы'"
          />
          <BaseButton variant="secondary" @click="reload">Повторить</BaseButton>
        </div>
        <p v-else-if="records.length === 0" class="py-10 text-center text-sm text-ink-muted">
          {{ income ? 'Доходов пока нет' : 'Расходов пока нет' }}
        </p>
        <ul v-else class="divide-y divide-ink/20 text-caption tracking-normal">
          <li v-for="record in records" :key="record.uid" class="min-w-0 py-3 first:pt-0">
            <time :datetime="record.transaction_date" class="tabular-nums text-ink-muted">{{
              formatDate(record.transaction_date)
            }}</time>
            <div class="mt-1 flex items-baseline justify-between gap-2">
              <span class="min-w-0 truncate" :title="record.category.name">{{
                record.category.name
              }}</span>
              <span class="shrink-0 whitespace-nowrap font-semibold tabular-nums">{{
                formatMoney(record.money_sum)
              }}</span>
            </div>
            <p
              v-if="record.description"
              data-testid="description"
              class="mt-1 truncate text-ink-muted"
              :title="record.description"
            >
              {{ record.description }}
            </p>
          </li>
        </ul>
      </template>
    </div>
  </section>
</template>
