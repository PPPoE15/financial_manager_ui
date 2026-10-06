<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import logoUrl from '@/assets/logo.svg'
import LoginForm from '@/components/auth/LoginForm.vue'
import RegistrationForm from '@/components/auth/RegistrationForm.vue'
import { LOGIN_ROUTE, REGISTER_ROUTE } from '@/router/names'

// Экран «Вход» / «Регистрация» по макетам Figma Frame 6 / Frame 7 (узлы 114:369, 116:32)
const route = useRoute()
const isLogin = computed(() => route.name !== REGISTER_ROUTE)

const tabs = [
  { route: LOGIN_ROUTE, label: 'Вход' },
  { route: REGISTER_ROUTE, label: 'Регистрация' },
] as const

// На узком экране логотип стоит на светлом фоне: тот же SVG из макета, перекрашенный маской в primary
// TODO(FM-12): взять url(...) в кавычки — если SVG станет меньше assetsInlineLimit (4 КиБ), Vite встроит его
// как data-URI, и значение без кавычек может оказаться невалидным (logo.svg сейчас всего на 81 байт больше
// лимита). Заодно вынести маску в CSS-класс с переменной для url — WebkitMask* Vue подставит сам.
// TODO(FM-12): у <img> ниже height="64.8" — атрибуты width/height по HTML должны быть целыми (размер задаёт CSS).
const logoMask = {
  maskImage: `url(${logoUrl})`,
  WebkitMaskImage: `url(${logoUrl})`,
  maskSize: 'contain',
  WebkitMaskSize: 'contain',
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
}
</script>

<template>
  <main class="flex min-h-screen bg-surface font-sans text-ink">
    <!-- pb-[18px]: в макете блок со слоганом на 9px выше центра панели -->
    <aside
      class="relative hidden w-1/2 flex-col justify-center bg-primary px-12 pb-[18px] text-ink-inverse lg:flex 2xl:px-[100px]"
    >
      <div class="absolute left-12 top-[100px] flex items-start gap-[26.4px] 2xl:left-[100px]">
        <div class="relative h-[57.6px] w-[48.6px] shrink-0">
          <img
            :src="logoUrl"
            alt=""
            width="63"
            height="64.8"
            class="absolute -left-[7.2px] top-0 max-w-none"
          />
        </div>
        <p class="mt-[3px] font-brand text-xl font-bold">Финансовый<br />менеджер</p>
      </div>
      <p class="text-3xl font-bold xl:text-4xl">Больше ясности<br />в каждом решении</p>
      <p class="mt-12 text-lg">Успех начинается с порядка - ваши финансы в одном пространстве</p>
    </aside>

    <!-- В макете форма 660px стоит по центру панели 960px (по 150px с боков) — центрируем, а не задаём отступ -->
    <section class="flex w-full justify-center px-4 py-8 sm:px-10 lg:w-1/2 lg:pt-[100px]">
      <div class="w-full max-w-[660px]">
        <div class="mb-8 flex items-center gap-3 lg:hidden">
          <span
            aria-hidden="true"
            class="h-[32.4px] w-[31.5px] shrink-0 bg-primary"
            :style="logoMask"
          />
          <p class="font-brand text-base font-bold tracking-normal text-primary">
            Финансовый<br />менеджер
          </p>
        </div>

        <h1 class="text-xl font-bold text-primary sm:text-3xl">
          {{ isLogin ? 'С возвращением!' : 'Добро пожаловать!' }}
        </h1>
        <h2 class="mt-6 text-lg font-semibold sm:text-2xl lg:mt-[84px]">
          {{ isLogin ? 'Войти в аккаунт' : 'Создать аккаунт' }}
        </h2>

        <nav
          aria-label="Вход или регистрация"
          class="mt-[23px] grid h-control grid-cols-2 gap-[6px] rounded bg-surface-muted p-[3px]"
        >
          <RouterLink
            v-for="tab in tabs"
            :key="tab.route"
            :to="{ name: tab.route }"
            class="flex items-center justify-center rounded-md text-base tracking-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :class="
              route.name === tab.route
                ? 'bg-surface-card font-bold text-primary'
                : 'font-medium text-ink-muted hover:text-primary'
            "
          >
            {{ tab.label }}
          </RouterLink>
        </nav>

        <div class="mt-[33px]">
          <!-- TODO(FM-12): при смене вкладки форма уничтожается, а начатый запрос продолжается: успешный
               вход/автовход всё равно уведёт на главную посреди заполнения другой вкладки; введённая почта
               теряется. Блокировать вкладки во время запроса и/или хранить общую почту во view. -->
          <LoginForm v-if="isLogin" />
          <RegistrationForm v-else />
        </div>
      </div>
    </section>
  </main>
</template>
