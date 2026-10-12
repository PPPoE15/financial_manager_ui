import { length } from '@/auth/validation'
import { formatMoney } from '@/utils/money'

/** Результат проверки поля: значение для запроса или текст ошибки. */
export type FieldCheck<T> = { value: T; error?: never } | { error: string; value?: never }

// Ограничения из contracts/auth.openapi.yaml (`UserName`) и contracts/transaction.openapi.yaml
// (`StartingBalanceCreate.amount`); сервер проверяет их сам, здесь — чтобы показать ошибку сразу.
const NAME_MAX_LENGTH = 64
const AMOUNT_LIMIT = 1_000_000_000

// Управляющие символы U+0000–U+001F и U+007F сервер отклоняет (шаблон `UserName`)
function hasControlCharacters(value: string): boolean {
  return [...value].some((char) => {
    const code = char.codePointAt(0) ?? 0
    return code < 0x20 || code === 0x7f
  })
}

export const AMOUNT_RANGE_ERROR = `Сумма должна быть от ${formatMoney(-AMOUNT_LIMIT)} до ${formatMoney(AMOUNT_LIMIT)}`

/** «Как Вас зовут?»: 1–64 символа после обрезки пробелов по краям, без управляющих символов. */
export function validateName(input: string): FieldCheck<string> {
  const value = input.trim()
  if (!value) return { error: 'Введите имя' }
  if (length(value) > NAME_MAX_LENGTH) return { error: `Не длиннее ${NAME_MAX_LENGTH} символов` }
  if (hasControlCharacters(value)) return { error: 'Имя содержит недопустимые символы' }
  return { value }
}

/**
 * «Сумма накоплений»: целое число рублей от −1 000 000 000 до 1 000 000 000, может быть отрицательным
 * (долг). Пробелы (в том числе неразрывные) — разделители разрядов; минус — дефис или «−».
 */
export function parseAmount(input: string): FieldCheck<number> {
  const compact = input.replace(/\s/g, '').replace('−', '-')
  if (!compact) return { error: 'Введите сумму' }
  if (!/^-?\d+$/.test(compact)) return { error: 'Введите целое число рублей' }

  const value = Number(compact)
  if (Math.abs(value) > AMOUNT_LIMIT) return { error: AMOUNT_RANGE_ERROR }
  // `-0` отправился бы как 0, но в тестах и сравнениях удобнее обычный ноль
  return { value: value === 0 ? 0 : value }
}
