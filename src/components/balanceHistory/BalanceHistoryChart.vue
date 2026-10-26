<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import type { BalanceHistoryPoint } from '@/types/balanceHistory'
import { formatMoney } from '@/utils/money'

const props = defineProps<{ points: BalanceHistoryPoint[] }>()
const selectedDate = ref('')
const outputId = useId()
const selected = computed(
  /** Находит выбранный день без преобразования суммы. */ () =>
    props.points.find(
      /** Сопоставляет календарную дату. */ (point) => point.date === selectedDate.value,
    ),
)
watch(
  /** Следит за заменой всего диапазона. */ () => props.points,
  /** Сохраняет выбранный день либо выбирает последний день диапазона. */ (points) => {
    if (
      !points.some(
        /** Проверяет наличие выбранного дня. */ (point) => point.date === selectedDate.value,
      )
    ) {
      selectedDate.value = points[points.length - 1]?.date ?? ''
    }
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
/** Сокращает только подписи оси, сохраняя точное значение в доступном поле. */
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
      aria-hidden="true"
      class="grid min-w-0 grid-cols-[64px_minmax(0,1fr)] gap-x-2 text-[10px] text-ink-muted sm:text-caption"
    >
      <div class="flex h-40 flex-col justify-between py-1">
        <span v-for="(tick, index) in geometry.ticks" :key="index" class="whitespace-nowrap"
          >{{ axisLabel(tick) }} ₽</span
        >
      </div>
      <svg viewBox="0 0 640 160" preserveAspectRatio="none" class="h-40 w-full overflow-visible">
        <line
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
            r="3"
            fill="currentColor"
            class="text-success"
            @mouseenter="selectedDate = dot.date"
            @click="selectedDate = dot.date"
          >
            <title>{{ dateLabel(dot.date) }}: {{ formatMoney(dot.balance) }}</title>
          </circle>
        </template>
      </svg>
      <div />
      <div class="flex justify-between gap-1 pt-1">
        <span v-for="point in dateLabels" :key="point.date">{{
          dateLabel(point.date).slice(0, 5)
        }}</span>
      </div>
      <p class="col-start-2 mt-1 text-right">Дни</p>
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-2 text-caption">
      <select
        v-model="selectedDate"
        aria-label="Точное значение за день"
        :aria-describedby="outputId"
        class="min-w-0 rounded border border-field-border bg-field px-2 py-1 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
      >
        <option v-for="point in points" :key="point.date" :value="point.date">
          {{ dateLabel(point.date) }}
        </option>
      </select>
      <output :id="outputId" aria-live="polite" class="break-words tabular-nums">{{
        selected?.balance === null || !selected
          ? 'Остаток неизвестен'
          : formatMoney(selected.balance)
      }}</output>
    </div>
  </div>
</template>
