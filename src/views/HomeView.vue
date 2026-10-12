<script setup lang="ts">
import { computed } from 'vue'

import BudgetStructureCard from '@/components/budget/BudgetStructureCard.vue'
import FirstStepDialog from '@/components/firstStep/FirstStepDialog.vue'
import { useSessionStore } from '@/stores/session'

// Экран «Обзор» по макету Figma Frame 8 (узел 116:64): приветствие и таблица «Структура бюджета»;
// карточки остатка, доходов и расходов появятся с экранами FM-2 и далее.
const session = useSessionStore()
// TODO(FM-13): имя пользователя берётся из `session.user` здесь и в AppLayout — вынести в геттер store.
// Без имени (`name = null` до окна «Первый шаг») — «Добрый день» без запятой
const greeting = computed(() =>
  session.user?.name ? `Добрый день, ${session.user.name}` : 'Добрый день',
)
</script>

<template>
  <div class="px-4 py-8 sm:px-10 lg:px-[69px] lg:pt-[106px]">
    <!-- lg:px-[69px]: в макете панель шириной 278px начинается с x=-1, заголовок — с x=347 -->
    <h1 class="text-xl font-bold text-primary sm:text-3xl">{{ greeting }}</h1>
    <!-- В макете карточка 863px идёт под «Текущим остатком»; пока его нет — сразу под заголовком,
         с тем же отступом, что у остатка (44px) -->
    <BudgetStructureCard class="mt-8 max-w-[863px] lg:mt-[44px]" />
    <!-- Окно поверх главной, пока не заполнены имя или стартовый остаток. Приветствие обновляется
         само через session.user; NOTE(FM-39): от стартового остатка на главной пока ничего не зависит —
         карточка «Сумма бюджета» (`GET /balance`) должна перезапрашиваться после закрытия окна. -->
    <FirstStepDialog />
  </div>
</template>
