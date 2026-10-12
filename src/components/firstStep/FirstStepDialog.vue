<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

import FirstStepField from '@/components/firstStep/FirstStepField.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import { useFirstStep } from '@/firstStep/useFirstStep'

// Окно «Первый шаг» по макету «Приветствие» (секция «Новый дизайн», узел 220:81) поверх главной.
// Цвета — текущей темы приложения: переход на новый дизайн не входит в FM-39. Окно обязательное:
// крестика в макете нет, Escape и клик по фону его не закрывают, фокус удерживается внутри.
const { needName, needBalance, visible, form, errors, message, submitting, check, submit } =
  useFirstStep()

const titleId = useId()
const panel = ref<HTMLElement | null>(null)

const FOCUSABLE = 'input:not([disabled]), button:not([disabled])'

function focusables(): HTMLElement[] {
  return panel.value ? [...panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)] : []
}

/** Фокус на первое поле, если его в окне нет (окно только открылось или блок с фокусом убран). */
function keepFocusInside(): void {
  if (panel.value && !panel.value.contains(document.activeElement)) focusables()[0]?.focus()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    return
  }
  if (event.key !== 'Tab') return

  const items = focusables()
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

// Приложение под окном недоступно ни мыши, ни клавиатуре, ни скринридеру; окно вынесено в body,
// поэтому inert на #app его не задевает
function setAppInert(value: boolean): void {
  document.getElementById('app')?.toggleAttribute('inert', value)
}

watch(visible, async (open) => {
  setAppInert(open)
  if (open) {
    await nextTick()
    keepFocusInside()
  }
})

async function onSubmit(): Promise<void> {
  await submit()
  await nextTick()
  if (visible.value) keepFocusInside()
}

onMounted(check)
onBeforeUnmount(() => setAppInert(false))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-8 font-sans text-ink backdrop-blur-sm sm:items-center"
    >
      <div
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        class="w-full max-w-[800px] rounded bg-surface-card px-6 py-8 shadow-xl sm:px-[100px] sm:py-[70px]"
        @keydown="onKeydown"
      >
        <h2 :id="titleId" class="text-2xl font-bold text-primary sm:text-3xl">Первый шаг</h2>
        <!-- novalidate: проверку делаем сами и показываем свои сообщения -->
        <form
          class="mt-8 flex flex-col gap-8 sm:mt-[60px] sm:gap-[60px]"
          novalidate
          @submit.prevent="onSubmit"
        >
          <FirstStepField
            v-if="needName"
            v-model="form.name"
            label="Как Вас зовут?"
            hint="Хотим обращаться к Вам по имени"
            placeholder="Ваше имя"
            autocomplete="given-name"
            :error="errors.name"
          />
          <FirstStepField
            v-if="needBalance"
            v-model="form.amount"
            label="Ваш текущий бюджет?"
            hint="Для начала отсчета"
            placeholder="Сумма накоплений"
            suffix="₽"
            :error="errors.amount"
          />
          <div class="flex flex-col gap-3">
            <ErrorMessage data-testid="form-error" :message="message" />
            <BaseButton type="submit" class="w-full" :loading="submitting">Приступим</BaseButton>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
