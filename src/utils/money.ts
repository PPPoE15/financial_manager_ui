/** Прочерк вместо отсутствующей суммы (`null` в API): «нет данных» — это не то же самое, что `0 ₽`. */
export const MISSING_VALUE = '—'

// TODO(FM-28): здесь буквальный U+00A0 — в диффе не отличить от пробела, записать как '\u00a0'.
const NBSP = ' '

/**
 * Денежная сумма в целых рублях (как в API) для показа в UI: `10 000 ₽`, `0 ₽`, `−5 000 ₽`;
 * `null` — прочерк. Разряды и `₽` отделены неразрывным пробелом, чтобы сумма не переносилась.
 * Группируем сами, а не через `Intl.NumberFormat('ru-RU')`: тот не делит четырёхзначные числа
 * (`9436`), а знак минуса у него разный в разных движках.
 */
export function formatMoney(value: number | null): string {
  if (value === null) return MISSING_VALUE
  // NOTE(FM-28): рассчитан на целые рубли из API; для дробных знак берётся до округления
  // (`-0.4` → `−0 ₽`), NaN/Infinity не обрабатываются.
  const sign = value < 0 ? '−' : ''
  const digits = String(Math.abs(Math.round(value))).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  return `${sign}${digits}${NBSP}₽`
}
