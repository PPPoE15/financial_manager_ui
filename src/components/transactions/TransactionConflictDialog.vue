<script setup lang="ts">
import type { Transaction } from '@/types/transaction'
import type { TransactionDraft } from '@/transactions/editorModel'
defineProps<{ draft: TransactionDraft; current: Transaction | null | undefined; busy: boolean }>()
const emit = defineEmits<{ cancel: []; accept: []; reapply: []; retry: [] }>()
</script>
<template>
  <section
    data-editor-dialog
    role="dialog"
    aria-modal="true"
    aria-labelledby="conflict-title"
    tabindex="-1"
    class="max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-md bg-gradient-to-r from-dialog-start to-dialog-end p-6 shadow-xl"
  >
    <h2 id="conflict-title" class="text-lg font-medium">Сверка операции</h2>
    <p class="mt-2 text-sm">
      Проверьте данные перед новой отправкой. Перенос правок не сохраняет их автоматически.
    </p>
    <div class="mt-4 grid gap-4 sm:grid-cols-3">
      <section>
        <h3 class="font-semibold">Исходные данные</h3>
        <p>{{ draft.original.transaction_date }}</p>
        <p>{{ draft.original.money_sum }} ₽</p>
        <p>{{ draft.original.category.name }}</p>
        <p class="break-words">{{ draft.original.description || '—' }}</p>
      </section>
      <section>
        <h3 class="font-semibold">Ваши правки</h3>
        <p>{{ draft.values.date }}</p>
        <p>{{ draft.values.amount }} ₽</p>
        <p class="break-all">
          {{
            draft.values.category_uid === draft.original.category.uid
              ? draft.original.category.name
              : draft.values.category_uid
          }}
        </p>
        <p class="break-words">{{ draft.values.description || '—' }}</p>
      </section>
      <section>
        <h3 class="font-semibold">Сейчас на сервере</h3>
        <template v-if="current"
          ><p>{{ current.transaction_date }}</p>
          <p>{{ current.money_sum }} ₽</p>
          <p>{{ current.category.name }}</p>
          <p class="break-words">{{ current.description || '—' }}</p></template
        >
        <p v-else>
          {{
            busy
              ? 'Загрузка…'
              : current === null
                ? 'Операция не найдена при сверке списка. Это не подтверждает удаление: данные могли измениться.'
                : 'Не удалось загрузить данные'
          }}
        </p>
      </section>
    </div>
    <footer class="mt-6 flex flex-wrap justify-end gap-3">
      <button
        type="button"
        :disabled="busy"
        class="min-h-control rounded bg-field px-4 focus-visible:outline"
        @click="emit('cancel')"
      >
        Остаться
      </button>
      <button
        v-if="current === undefined"
        type="button"
        :disabled="busy"
        class="min-h-control rounded bg-action px-4 text-action-foreground"
        @click="emit('retry')"
      >
        Повторить
      </button>
      <button
        v-else
        type="button"
        :disabled="busy"
        class="min-h-control rounded bg-field px-4 focus-visible:outline"
        @click="emit('accept')"
      >
        {{ current === null ? 'Отбросить черновик' : 'Принять актуальные' }}
      </button>
      <button
        v-if="current"
        type="button"
        :disabled="busy"
        class="min-h-control rounded bg-action px-4 text-action-foreground focus-visible:outline"
        @click="emit('reapply')"
      >
        Перенести мои правки
      </button>
    </footer>
  </section>
</template>
