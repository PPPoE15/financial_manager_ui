const DAY_MS = 86_400_000

/** Возвращает календарную дату в часовом поясе отчёта. */
export function moscowToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Возвращает номер календарного дня, отклоняя несуществующие даты. */
function dayNumber(value: string): number | null {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return null
  const time = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) return null
  return time / DAY_MS
}

/** Проверяет годы, порядок, включительную длину и верхнюю границу диапазона. */
export function validateRange(from: string, to: string, today = moscowToday()): string {
  const start = dayNumber(from)
  const end = dayNumber(to)
  if (start === null || end === null) return 'Укажите существующие даты с 2000 по 2099 год'
  if (end < start) return 'Дата «До» должна быть не раньше даты «От»'
  if (to > today) return 'Выберите даты не позже сегодняшнего дня по Москве'
  if (end - start + 1 > 366) return 'Выберите диапазон от 1 до 366 дней включительно'
  return ''
}

/** Выбирает последние четырнадцать календарных дней для первого открытия. */
export function defaultRange(today = moscowToday()): { from: string; to: string } {
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - 13 * DAY_MS).toISOString().slice(0, 10)
  return { from: from < '2000-01-01' ? '2000-01-01' : from, to: today }
}
