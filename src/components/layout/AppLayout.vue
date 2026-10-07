<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import logoUrl from '@/assets/logo.svg'
import { useSignOut } from '@/auth/useSignOut'
import { HOME_ROUTE } from '@/router/names'
import { useSessionStore } from '@/stores/session'

// Каркас защищённых экранов по макету Figma Frame 8 «Главная» (узел 116:64): боковая панель с логотипом,
// меню и блоком пользователя с кнопкой «Выход». Узкого макета нет — ниже lg панель становится верхней
// полосой (логотип, пользователь, «Выход»), меню скрыто (согласованное отклонение, FM-13).
const route = useRoute()
const session = useSessionStore()
const signOut = useSignOut()

const userName = computed(() => session.user?.name ?? '')
// NOTE(FM-13): в API нет аватара — вместо фото из макета круг с первой буквой имени.
const userInitial = computed(() => userName.value.trim().charAt(0).toUpperCase())

// TODO(FM-2): добавить пункты «Мои категории», «Новая операция», «Настройки» вместе с их экранами.
// TODO(FM-2): активный пункт сейчас — точное совпадение имени маршрута; с вложенными экранами раздела
// перейти на состояние RouterLink (`isActive`/`isExactActive`), иначе подсветка пропадёт.
const menu = [{ route: HOME_ROUTE, label: 'Обзор' }] as const
</script>

<template>
  <div class="min-h-screen bg-surface font-sans text-ink lg:flex">
    <aside
      class="flex items-center gap-3 bg-primary px-4 py-3 text-ink-inverse lg:sticky lg:top-0 lg:h-screen lg:w-[278px] lg:shrink-0 lg:flex-col lg:items-stretch lg:gap-0 lg:px-[19px] lg:pb-[14px] lg:pt-[21px]"
    >
      <div class="flex shrink-0 items-start gap-[14.85px] lg:pl-[7px]">
        <!-- Тот же SVG, что на экране входа, в масштабе макета: рамка 27.34×32.4, рисунок шире рамки -->
        <div class="relative h-[32.4px] w-[27.34px] shrink-0">
          <img
            :src="logoUrl"
            alt=""
            width="35"
            height="36"
            class="absolute -left-[4.05px] top-0 h-[36.45px] w-[35.44px] max-w-none"
          />
        </div>
        <p class="mt-[1.7px] font-brand text-[13.5px] font-bold leading-[18px]">
          Финансовый<br />менеджер
        </p>
      </div>

      <nav aria-label="Основное меню" class="hidden lg:mt-[121px] lg:block">
        <RouterLink
          v-for="item in menu"
          :key="item.route"
          :to="{ name: item.route }"
          class="flex h-[39px] items-center rounded-md pl-[44px] text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-accent"
          :class="
            route.name === item.route
              ? 'bg-primary-muted font-extrabold text-ink-inverse'
              : 'font-medium text-sidebar-text hover:text-ink-inverse'
          "
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div
        class="ml-auto flex min-w-0 items-center gap-3 lg:ml-0 lg:mt-auto lg:flex-col lg:items-stretch lg:gap-[19px]"
      >
        <div data-testid="current-user" class="flex min-w-0 items-center gap-[11px] lg:pl-[7px]">
          <span
            data-testid="user-avatar"
            aria-hidden="true"
            class="flex size-[35px] shrink-0 items-center justify-center rounded-full border border-ink-inverse bg-primary-muted font-brand text-base font-extrabold tracking-normal"
            >{{ userInitial }}</span
          >
          <span
            class="hidden truncate font-brand text-base font-extrabold tracking-normal sm:block"
            >{{ userName }}</span
          >
        </div>
        <button
          type="button"
          class="h-[39px] shrink-0 rounded bg-primary-dark px-4 text-base font-bold tracking-normal text-sidebar-accent transition-colors hover:text-ink-inverse focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-accent"
          @click="signOut"
        >
          Выход
        </button>
      </div>
    </aside>

    <main class="min-w-0 flex-1">
      <RouterView />
    </main>
  </div>
</template>
