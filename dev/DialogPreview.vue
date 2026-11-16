<script setup lang="ts">
import { ref } from 'vue'
import FirstStepDialog from '../src/components/firstStep/FirstStepDialog.vue'
import CategoryEditorDialog from '../src/components/categories/CategoryEditorDialog.vue'
const first = new URLSearchParams(location.search).has('first')
const open = ref(!first)
</script>
<template>
  <main class="min-h-screen bg-landscape bg-cover bg-center p-8 text-ink">
    <h1 class="text-3xl">Добрый день, Артем</h1>
    <button class="mt-8 rounded bg-action p-4 text-action-foreground" @click="open = true">Редактировать категории</button>
    <div class="mt-8 grid grid-cols-2 gap-6"><div v-for="n in 4" :key="n" class="h-48 rounded bg-surface-card/60 p-6">Структура бюджета</div></div>
    <FirstStepDialog v-if="first" />
    <CategoryEditorDialog v-else-if="open" @close="open = false" />
  </main>
</template>
