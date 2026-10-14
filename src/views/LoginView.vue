<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import logoUrl from '@/assets/new-design/logo.svg'
import LoginForm from '@/components/auth/LoginForm.vue'
import RegistrationForm from '@/components/auth/RegistrationForm.vue'
import { LOGIN_ROUTE, REGISTER_ROUTE } from '@/router/names'

const route = useRoute()
const isLogin = computed(() => route.name !== REGISTER_ROUTE)
const tabs = [
  { route: LOGIN_ROUTE, label: 'Вход' },
  { route: REGISTER_ROUTE, label: 'Регистрация' },
] as const
</script>

<template>
  <main class="min-h-screen bg-surface font-sans text-ink lg:grid lg:grid-cols-2">
    <!-- FM-56: «Новый дизайн», 214:518 / 220:24. На узком экране — компактный логотип над формой. -->
    <aside class="relative hidden min-h-[max(100vh,540px)] bg-surface-brand lg:block">
      <div class="absolute inset-0 bg-landscape bg-[length:200%_100%] bg-left opacity-20" />
      <div class="relative flex min-h-[max(100vh,540px)] flex-col justify-between px-[7%] py-[10vh]">
        <p class="font-brand text-[clamp(24px,2.5vw,48px)] font-medium">
          Ваш путь к финансовой свободе
        </p>
        <img
          :src="logoUrl"
          alt="Финансовый менеджер"
          width="334"
          height="101"
          class="absolute left-[14%] top-1/2 h-auto w-[34.8%] max-w-[334px] -translate-y-1/2"
        />
        <p class="font-brand text-[clamp(14px,1.04vw,20px)] font-medium">
          Успех начинается с порядка - ваши финансы в одном пространстве
        </p>
      </div>
    </aside>

    <section class="px-4 py-8 sm:px-10 lg:px-10 lg:pb-16 lg:pt-[28.635vh]">
      <div class="mx-auto w-full max-w-[495px]">
        <img
          :src="logoUrl"
          alt="Финансовый менеджер"
          width="334"
          height="101"
          class="mb-10 h-auto w-[240px] max-w-full lg:hidden"
        />
        <h1 class="text-xl font-semibold">{{ isLogin ? 'Войти в аккаунт' : 'Создать аккаунт' }}</h1>

        <!-- TODO(FM-13): при переключении вкладок теряется redirect из query. -->
        <nav
          aria-label="Вход или регистрация"
          class="mt-[18px] grid min-h-control grid-cols-2 rounded bg-surface-card"
        >
          <RouterLink
            v-for="tab in tabs"
            :key="tab.route"
            :to="{ name: tab.route }"
            class="flex min-h-control items-center justify-center rounded px-2 py-2 text-sm tracking-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            :class="
              route.name === tab.route
                ? 'bg-action font-bold text-action-foreground'
                : 'font-medium text-ink-muted hover:bg-field-hover hover:text-ink'
            "
          >
            {{ tab.label }}
          </RouterLink>
        </nav>

        <div class="mt-[52px]">
          <!-- TODO(FM-12): смена вкладки уничтожает форму, но не отменяет начатый запрос;
               успешный вход может увести со второй вкладки. Блокировать переключение при отправке. -->
          <LoginForm v-if="isLogin" />
          <RegistrationForm v-else />
        </div>
      </div>
    </section>
  </main>
</template>
