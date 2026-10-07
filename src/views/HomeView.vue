<script setup lang="ts">
import { computed } from 'vue'

import { useSessionStore } from '@/stores/session'

// Заглушка главной по макету Figma Frame 8 (узел 116:64): пока только приветствие, карточки остатка,
// категорий, доходов и расходов появятся с экранами FM-2 и далее.
const session = useSessionStore()
// TODO(FM-13): имя пользователя берётся из `session.user` здесь и в AppLayout — вынести в геттер store.
const greeting = computed(() =>
  session.user ? `Добрый день, ${session.user.name}` : 'Добрый день',
)
</script>

<template>
  <div class="px-4 py-8 sm:px-10 lg:px-[69px] lg:pt-[106px]">
    <!-- lg:px-[69px]: в макете панель шириной 278px начинается с x=-1, заголовок — с x=347 -->
    <h1 class="text-xl font-bold text-primary sm:text-3xl">{{ greeting }}</h1>
  </div>
</template>
