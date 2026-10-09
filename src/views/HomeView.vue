<script setup lang="ts">
import { computed } from 'vue'

import BudgetStructureCard from '@/components/budget/BudgetStructureCard.vue'
import { useSessionStore } from '@/stores/session'

// Экран «Обзор» по макету Figma Frame 8 (узел 116:64): приветствие и таблица «Структура бюджета»;
// карточки остатка, доходов и расходов появятся с экранами FM-2 и далее.
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
    <!-- В макете карточка 863px идёт под «Текущим остатком»; пока его нет — сразу под заголовком,
         с тем же отступом, что у остатка (44px) -->
    <BudgetStructureCard class="mt-8 max-w-[863px] lg:mt-[44px]" />
  </div>
</template>
