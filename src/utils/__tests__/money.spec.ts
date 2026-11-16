import { describe, expect, it } from 'vitest'

import { formatMoney, MISSING_VALUE } from '@/utils/money'

// Разряды и знак рубля отделяются неразрывным пробелом, чтобы сумма не переносилась по частям
const NBSP = ' '

describe('formatMoney', () => {
  it('делит разряды и добавляет знак рубля', () => {
    expect(formatMoney(10000)).toBe(`10${NBSP}000${NBSP}₽`)
    expect(formatMoney(171000)).toBe(`171${NBSP}000${NBSP}₽`)
    expect(formatMoney(1234567890)).toBe(`1${NBSP}234${NBSP}567${NBSP}890${NBSP}₽`)
  })

  it('короткие суммы выводит без разделителя разрядов', () => {
    expect(formatMoney(9436)).toBe(`9${NBSP}436${NBSP}₽`)
    expect(formatMoney(500)).toBe(`500${NBSP}₽`)
  })

  it('ноль показывает как «0 ₽», а не прочерком', () => {
    expect(formatMoney(0)).toBe(`0${NBSP}₽`)
  })

  it('отсутствующее значение (null) показывает прочерком', () => {
    expect(formatMoney(null)).toBe(MISSING_VALUE)
    expect(MISSING_VALUE).toBe('—')
  })

  it('отрицательную сумму выводит со знаком минус', () => {
    expect(formatMoney(-5000)).toBe(`−5${NBSP}000${NBSP}₽`)
  })
})
