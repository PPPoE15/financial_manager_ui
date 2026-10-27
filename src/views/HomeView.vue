<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'

import BalanceHistoryCard from '@/components/balanceHistory/BalanceHistoryCard.vue'
import BudgetStructureCard from '@/components/budget/BudgetStructureCard.vue'
import RecentTransactionsCard from '@/components/transactions/RecentTransactionsCard.vue'
import TransactionEntryDialog from '@/components/transactions/TransactionEntryDialog.vue'
import ImportDialog from '@/components/imports/ImportDialog.vue'
import FirstStepDialog from '@/components/firstStep/FirstStepDialog.vue'
import { useSessionStore } from '@/stores/session'
import type { TransactionType } from '@/types/budget'

defineProps<{ importRequested?: boolean }>()
const emit = defineEmits<{ importClosed: [] }>()
const session = useSessionStore()
const incomeCard = useTemplateRef('incomeCard')
const outcomeCard = useTemplateRef('outcomeCard')
const budgetCard = useTemplateRef('budgetCard')
const historyCard = useTemplateRef('historyCard')
const firstStep = useTemplateRef('firstStep')
const entryType = ref<TransactionType | null>(null)

/** Обновляет отчёты после успешно сохранённых операций. */
function onTransactionsSaved() {
  void historyCard.value?.reload()
  reloadRecentTransactions()
  void budgetCard.value?.reload()
}

async function editCategories() {
  entryType.value = null
  // Сначала снять inert старого окна и вернуть фокус, затем открыть редактор.
  await nextTick()
  budgetCard.value?.openEditor()
}

function reloadRecentTransactions() {
  void incomeCard.value?.reload()
  void outcomeCard.value?.reload()
}
// TODO(FM-13): имя пользователя берётся из `session.user` здесь и в AppLayout — вынести в геттер store.
// Без имени (`name = null` до окна «Первый шаг») — «Добрый день» без запятой
const greeting = computed(() =>
  session.user?.name ? `Добрый день, ${session.user.name}` : 'Добрый день',
)
</script>

<template>
  <div class="px-4 pb-8 pt-6 sm:px-6 lg:px-[38px] lg:pt-8">
    <h1 class="break-words font-brand text-xl font-medium sm:text-2xl lg:min-h-11 lg:pr-[260px]">
      {{ greeting }}
    </h1>

    <!-- NOTE(FM-57): минимум 620px оставляет целый месяц рядом с 453px закреплённых колонок. -->
    <div class="mt-6 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(620px,1fr)]">
      <div class="min-w-0">
        <!-- Место под «Сумму бюджета» / «Свободные средства»: 150px макета × 0.75 темы.
             На узком экране пустое место скрыто; сами показатели появятся отдельно. -->
        <div aria-hidden="true" class="mb-4 hidden h-[112.5px] xl:block" />
        <div class="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <RecentTransactionsCard ref="incomeCard" type="income" @add="entryType = $event" />
          <RecentTransactionsCard ref="outcomeCard" type="outcome" @add="entryType = $event" />
        </div>
      </div>
      <div
        id="categories"
        tabindex="-1"
        class="min-w-0 scroll-mt-4 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus xl:col-start-2"
      >
        <BudgetStructureCard ref="budgetCard" @categories-saved="reloadRecentTransactions" />
      </div>
      <BalanceHistoryCard
        ref="historyCard"
        class="xl:col-start-1"
        @set-balance="firstStep?.openBalance()"
      />
    </div>
    <!-- Окно поверх главной, пока не заполнены имя или стартовый остаток. Приветствие обновляется
         само через session.user; график обновляется сразу после сохранения стартового остатка. -->
    <!-- TODO(FM-2): с появлением других защищённых экранов перенести окно в AppLayout, иначе вход по прямой
         ссылке на них пропустит «Первый шаг». -->
    <FirstStepDialog ref="firstStep" @balance-saved="historyCard?.reload()" />
    <ImportDialog
      v-if="importRequested"
      @saved="onTransactionsSaved"
      @close="emit('importClosed')"
    />
    <TransactionEntryDialog
      v-if="entryType"
      :type="entryType"
      @saved="onTransactionsSaved"
      @close="entryType = null"
      @edit-categories="editCategories"
    />
  </div>
</template>
