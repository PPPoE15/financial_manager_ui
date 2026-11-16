<script setup lang="ts">
defineProps<{ busy: boolean }>()
const emit = defineEmits<{ choose: [action: 'save' | 'discard' | 'stay'] }>()
</script>
<template>
  <section
    data-editor-dialog
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="leave-title"
    tabindex="-1"
    class="w-full max-w-lg rounded-md bg-gradient-to-r from-dialog-start to-dialog-end p-6 shadow-xl"
  >
    <h2 id="leave-title" class="text-lg font-medium">Есть несохранённые изменения</h2>
    <p class="mt-3 text-sm">Сохранить изменения перед продолжением?</p>
    <footer class="mt-6 flex flex-wrap justify-end gap-3">
      <button
        type="button"
        :disabled="busy"
        class="min-h-control rounded bg-field px-4 focus-visible:outline"
        @click="emit('choose', 'stay')"
      >
        Остаться
      </button>
      <button
        type="button"
        :disabled="busy"
        class="min-h-control rounded bg-field px-4 focus-visible:outline"
        @click="emit('choose', 'discard')"
      >
        Отбросить
      </button>
      <button
        type="button"
        :disabled="busy"
        class="min-h-control rounded bg-action px-4 text-action-foreground focus-visible:outline"
        @click="emit('choose', 'save')"
      >
        Сохранить
      </button>
    </footer>
  </section>
</template>
