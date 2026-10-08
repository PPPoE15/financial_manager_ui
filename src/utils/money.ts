/** Прочерк вместо отсутствующей суммы (`null` в API): «нет данных» — это не то же самое, что `0 ₽`. */
export const MISSING_VALUE = '—'

const NBSP = ' '

/**
 * Денежная сумма в целых рублях (как в API) для показа в UI: `10 000 ₽`, `0 ₽`, `−5 000 ₽`;
 * `null` — прочерк. Разряды и `₽` отделены неразрывным пробелом, чтобы сумма не переносилась.
 * Группируем сами, а не через `Intl.NumberFormat('ru-RU')`: тот не делит четырёхзначные числа
 * (`9436`), а знак минуса у него разный в разных движках.
 */
export function formatMoney(value: number | null): string {
  if (value === null) return MISSING_VALUE
  const sign = value < 0 ? '−' : ''
  const digits = String(Math.abs(Math.round(value))).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  return `${sign}${digits}${NBSP}₽`
}
