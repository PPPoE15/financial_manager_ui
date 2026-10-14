import { length } from '@/auth/validation'
import type { FieldCheck } from '@/firstStep/validation'
import { formatMoney } from '@/utils/money'

// Ограничения из contracts/transaction.openapi.yaml (`CategoryName`, `Description`, `money_plan`);
// сервер проверяет их сам, здесь — чтобы показать ошибку у поля сразу.
export const NAME_MAX_LENGTH = 64
export const DESCRIPTION_MAX_LENGTH = 500
export const PLAN_LIMIT = 1_000_000_000

function hasControlCharacters(value: string, allowed: readonly string[] = []): boolean {
  return [...value].some((char) => {
    const code = char.codePointAt(0) ?? 0
    return (code < 0x20 || code === 0x7f) && !allowed.includes(char)
  })
}

/** «Название категории»: 1–64 символа после обрезки пробелов по краям, без управляющих символов. */
export function validateCategoryName(input: string): FieldCheck<string> {
  const value = input.trim()
  if (!value) return { error: 'Введите название' }
  if (length(value) > NAME_MAX_LENGTH) return { error: `Не длиннее ${NAME_MAX_LENGTH} символов` }
  if (hasControlCharacters(value)) return { error: 'Название содержит недопустимые символы' }
  return { value }
}

/**
 * «План»: необязательный, целое число рублей от 0 до 1 000 000 000; пусто — плана нет (`null`).
 * Пробелы (в том числе неразрывные) — разделители разрядов.
 */
export function parsePlan(input: string): FieldCheck<number | null> {
  const compact = input.replace(/\s/g, '')
  if (!compact) return { value: null }
  if (!/^\d+$/.test(compact)) return { error: 'Введите целое число рублей не меньше 0' }

  const value = Number(compact)
  if (value > PLAN_LIMIT) return { error: `План — не больше ${formatMoney(PLAN_LIMIT)}` }
  return { value }
}

/** «Комментарий»: до 500 символов, табуляция и переводы строк допустимы; пусто — `null`. */
export function validateDescription(input: string): FieldCheck<string | null> {
  if (!input) return { value: null }
  if (length(input) > DESCRIPTION_MAX_LENGTH) {
    return { error: `Не длиннее ${DESCRIPTION_MAX_LENGTH} символов` }
  }
  if (hasControlCharacters(input, ['\t', '\n', '\r'])) {
    return { error: 'Комментарий содержит недопустимые символы' }
  }
  return { value: input }
}
