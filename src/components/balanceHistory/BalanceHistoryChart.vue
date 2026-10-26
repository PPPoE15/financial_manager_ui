<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import type { BalanceHistoryPoint } from '@/types/balanceHistory'
import { formatMoney } from '@/utils/money'

const props = defineProps<{ points: BalanceHistoryPoint[] }>()
const plot = ref<HTMLElement | null>(null)
const tooltipId = useId()
const helpId = useId()
const activeIndex = ref(0)
const focusedIndex = ref<number | null>(null)
const hoveredIndex = ref<number | null>(null)
const dismissed = ref(false)
watch(
  /** Следит за заменой диапазона отчёта. */ () => props.points,
  /** Сбрасывает подсказку и оставляет один вход с клавиатуры на первой известной точке. */ (
    points,
  ) => {
    activeIndex.value = points.findIndex(
      /** Пропускает дни без известного остатка. */ (point) => point.balance !== null,
    )
    focusedIndex.value = null
    hoveredIndex.value = null
    dismissed.value = false
  },
  { immediate: true },
)
const geometry = computed(
  /** Рассчитывает только координаты готовых остатков из API. */ () => {
    const values = props.points.flatMap(
      /** Исключает неизвестные значения из шкалы. */ (point) =>
        point.balance === null ? [] : [point.balance],
    )
    const low = Math.min(...values, values.length ? Infinity : 0)
    const high = Math.max(...values, values.length ? -Infinity : 0)
    const padding = Math.max((high - low) * 0.1, 1)
    const min = low - padding
    const max = high + padding
    const dots = props.points.map(
      /** Размещает календарный день на равномерной оси X. */ (point, index) => ({
        ...point,
        index,
        x: props.points.length === 1 ? 320 : 10 + (index * 620) / (props.points.length - 1),
        y: point.balance === null ? null : 8 + ((max - point.balance) * 140) / (max - min),
      }),
    )
    const segments: string[] = []
    let segment: string[] = []
    for (const dot of dots) {
      if (dot.y === null) {
        if (segment.length) segments.push(segment.join(' '))
        segment = []
      } else segment.push(`${dot.x},${dot.y}`)
    }
    if (segment.length) segments.push(segment.join(' '))
    return {
      dots,
      segments,
      ticks: Array.from(
        { length: 5 },
        /** Создаёт равномерные отметки шкалы в рублях. */ (_, index) =>
          Math.round(max - (index * (max - min)) / 4),
      ),
    }
  },
)
const selectedDot = computed(
  /** Показывает подсказку у наведённой или сфокусированной известной точки. */ () => {
    const index = hoveredIndex.value ?? focusedIndex.value
    return dismissed.value || index === null ? undefined : geometry.value.dots[index]
  },
)

/** Показывает подсказку при наведении на точку без изменения клавиатурного фокуса. */
function hoverPoint(index: number): void {
  hoveredIndex.value = index
  dismissed.value = false
}

/** Делает сфокусированную точку единственным входом по Tab и показывает её значение. */
function focusPoint(index: number): void {
  activeIndex.value = index
  focusedIndex.value = index
  hoveredIndex.value = null
  dismissed.value = false
}

/** Перемещает фокус между известными точками, не создавая остановок Tab для каждого дня. */
function onPointKeydown(event: KeyboardEvent, index: number): void {
  if (event.key === 'Escape') {
    dismissed.value = true
    event.preventDefault()
    return
  }
  const known = geometry.value.dots.filter(
    /** Исключает неизвестные дни из клавиатурной навигации. */ (dot) => dot.y !== null,
  )
  const current = known.findIndex(
    /** Находит текущую точку в последовательности известных остатков. */ (dot) =>
      dot.index === index,
  )
  let target = current
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target++
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target--
  else if (event.key === 'Home') target = 0
  else if (event.key === 'End') target = known.length - 1
  else return
  event.preventDefault()
  const dot = known[Math.max(0, Math.min(known.length - 1, target))]
  if (dot) plot.value?.querySelector<SVGElement>(`[data-point-index="${dot.index}"]`)?.focus()
}

// TODO(FM-88): размещать подписи дат по x точек: justify-between смещает их для одного и чётного числа дней.
const dateLabels = computed(
  /** Оставляет читаемые подписи дат даже на узком экране. */ () =>
    [...new Set([0, Math.floor((props.points.length - 1) / 2), props.points.length - 1])].flatMap(
      /** Пропускает отсутствующие элементы пустого диапазона. */ (index) =>
        props.points[index] ? [props.points[index]!] : [],
    ),
)
/** Форматирует дату без пересчёта календарного дня в локальный часовой пояс. */
function dateLabel(date: string): string {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`
}
/** Сокращает только подписи оси, сохраняя точное значение в подсказке точки. */
function axisLabel(value: number): string {
  return new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  )
}
</script>

<template>
  <div class="min-w-0">
    <p class="mb-3 text-caption text-ink-muted">
      <span aria-hidden="true" class="text-success">●</span> Общий остаток
    </p>
    <div
      class="grid min-w-0 grid-cols-[64px_minmax(0,1fr)] gap-x-2 text-[10px] text-ink-muted sm:text-caption"
    >
      <div aria-hidden="true" class="flex h-40 flex-col justify-between py-1">
        <span v-for="(tick, index) in geometry.ticks" :key="index" class="whitespace-nowrap"
          >{{ axisLabel(tick) }} ₽</span
        >
      </div>
      <div
        ref="plot"
        data-testid="balance-plot"
        class="relative min-w-0 h-40"
        @mouseleave="hoveredIndex = null"
      >
        <p :id="helpId" class="sr-only">
          Стрелки переключают точки, Home и End — начало и конец. Escape скрывает подсказку.
        </p>
        <svg
          role="group"
          aria-label="Общий остаток по дням"
          viewBox="0 0 640 160"
          preserveAspectRatio="none"
          class="h-40 w-full overflow-visible"
        >
          <line
            aria-hidden="true"
            v-for="index in 5"
            :key="`grid-${index}`"
            x1="0"
            x2="640"
            :y1="8 + (index - 1) * 35"
            :y2="8 + (index - 1) * 35"
            stroke="currentColor"
            stroke-opacity="0.15"
            vector-effect="non-scaling-stroke"
          />
          <polyline
            v-for="(segment, index) in geometry.segments"
            :key="index"
            aria-hidden="true"
            data-testid="balance-line"
            :points="segment"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            vector-effect="non-scaling-stroke"
            class="text-success"
          />
          <template v-for="dot in geometry.dots" :key="dot.date">
            <circle
              v-if="dot.y !== null"
              :cx="dot.x"
              :cy="dot.y"
              :data-point-index="dot.index"
              :tabindex="dot.index === activeIndex ? 0 : -1"
              role="button"
              :aria-label="`${dateLabel(dot.date)}: ${formatMoney(dot.balance)}`"
              :aria-describedby="helpId"
              r="4"
              stroke="transparent"
              stroke-width="12"
              vector-effect="non-scaling-stroke"
              fill="currentColor"
              class="text-success focus:outline-none focus:stroke-focus focus:stroke-2"
              @mouseenter="hoverPoint(dot.index)"
              @focus="focusPoint(dot.index)"
              @blur="focusedIndex = null"
              @keydown="onPointKeydown($event, dot.index)"
            />
          </template>
        </svg>
        <div
          v-if="selectedDot && selectedDot.y !== null"
          :id="tooltipId"
          role="tooltip"
          class="absolute z-10 max-w-full rounded border border-field-border bg-field px-2 py-1 text-caption text-ink shadow-panel pointer-events-none"
          :style="{
            left: `${(selectedDot.x / 640) * 100}%`,
            top: `${(selectedDot.y / 160) * 100}%`,
            transform: `translate(${selectedDot.x < 160 ? '0' : selectedDot.x > 480 ? '-100%' : '-50%'}, calc(-100% - 8px))`,
          }"
        >
          <span class="block">{{ dateLabel(selectedDot.date) }}</span>
          <span class="block font-semibold tabular-nums">{{
            formatMoney(selectedDot.balance)
          }}</span>
        </div>
      </div>
      <div />
      <div aria-hidden="true" class="flex justify-between gap-1 pt-1">
        <span v-for="point in dateLabels" :key="point.date">{{
          dateLabel(point.date).slice(0, 5)
        }}</span>
      </div>
      <p aria-hidden="true" class="col-start-2 mt-1 text-right">Дни</p>
    </div>
  </div>
</template>
