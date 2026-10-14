<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import logoUrl from '@/assets/new-design/logo.svg'
import { useSignOut } from '@/auth/useSignOut'
import { HOME_ROUTE } from '@/router/names'
import { useSessionStore } from '@/stores/session'

const route = useRoute()
const session = useSessionStore()
const signOut = useSignOut()
const userName = computed(() => session.user?.name?.trim() || 'Профиль')
const profile = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const logout = ref<HTMLButtonElement>()
const open = ref(false)
const focusStyle =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'
const menu = [
  { label: 'Обзор', hash: '' },
  { label: 'Мои категории', hash: '#categories' },
]

async function openProfile() {
  open.value = true
  await nextTick()
  logout.value?.focus()
}
function closeProfile(restoreFocus = true) {
  open.value = false
  if (restoreFocus) trigger.value?.focus()
}
function outside(event: Event) {
  if (open.value && event.target instanceof Node && !profile.value?.contains(event.target)) {
    closeProfile(event.type === 'pointerdown')
  }
}
async function focusCategories() {
  if (route.hash !== '#categories') return
  await nextTick()
  const target = document.getElementById('categories')
  target?.focus({ preventScroll: true })
  target?.scrollIntoView?.({ block: 'start' })
}
watch(() => route.hash, focusCategories, { flush: 'post' })
onMounted(() => {
  void focusCategories()
  document.addEventListener('pointerdown', outside)
  document.addEventListener('focusin', outside)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('focusin', outside)
})
</script>

<template>
  <div
    class="relative min-h-screen bg-surface bg-landscape bg-cover bg-fixed bg-center font-sans text-ink lg:flex"
  >
    <div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-surface/80"></div>
    <!-- FM-57: узкая компоновка согласована отдельно; desktop — Figma 230:422 / 237:1116. -->
    <aside
      class="relative bg-surface-card/70 px-4 pb-3 pt-4 lg:sticky lg:top-0 lg:h-screen lg:w-[180px] lg:shrink-0 lg:px-3"
    >
      <img
        :src="logoUrl"
        alt="Финансовый менеджер"
        class="h-9 w-[126px] object-contain object-left"
      />
      <nav aria-label="Основное меню" class="mt-7 flex gap-2 lg:mt-12 lg:flex-col lg:gap-2">
        <RouterLink
          v-for="item in menu"
          :key="item.label"
          :to="{ name: HOME_ROUTE, hash: item.hash }"
          :aria-current="route.hash === item.hash ? (item.hash ? 'location' : 'page') : 'false'"
          class="flex min-h-11 items-center rounded px-3 text-sm lg:px-6"
          :class="[
            focusStyle,
            route.hash === item.hash
              ? 'bg-action font-bold text-action-foreground'
              : 'text-ink-secondary hover:bg-surface-muted',
          ]"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
      <!-- NOTE(FM-57): новая операция, CSV и настройки скрыты до появления рабочих сценариев. -->
    </aside>

    <div
      ref="profile"
      class="absolute right-4 top-3 z-20 max-w-[calc(100%-160px)] lg:right-6 lg:top-4 lg:max-w-[260px]"
      @keydown.esc.stop.prevent="closeProfile()"
    >
      <button
        ref="trigger"
        type="button"
        data-testid="current-user"
        aria-controls="profile-menu"
        :aria-expanded="open"
        :aria-label="`Меню профиля: ${userName}`"
        class="flex min-h-11 w-full items-center gap-2 rounded px-2 text-sm font-bold"
        :class="[focusStyle, open ? 'bg-surface-card' : 'bg-surface-card/60 hover:bg-surface-card']"
        @click="open ? closeProfile() : openProfile()"
        @keydown.down.prevent="openProfile()"
      >
        <!-- API не предоставляет аватар: нейтральный силуэт не зависит от наличия имени. -->
        <span
          data-testid="user-avatar"
          aria-hidden="true"
          class="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-secondary"
        >
          <svg
            viewBox="0 0 24 24"
            class="size-6"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <circle cx="12" cy="8" r="3" />
            <path d="M5 21v-3a7 7 0 0 1 14 0v3" />
          </svg>
        </span>
        <span class="min-w-0 truncate">{{ userName }}</span>
        <span aria-hidden="true" class="shrink-0">{{ open ? '⌃' : '⌄' }}</span>
      </button>
      <div
        v-if="open"
        id="profile-menu"
        class="absolute right-0 w-full min-w-36 rounded bg-surface-card p-2 shadow-panel"
      >
        <button
          ref="logout"
          type="button"
          class="min-h-11 w-full rounded px-3 text-left text-sm hover:bg-surface-muted"
          :class="focusStyle"
          @click="signOut"
        >
          Выйти
        </button>
      </div>
    </div>
    <main class="relative min-w-0 flex-1"><RouterView /></main>
  </div>
</template>
