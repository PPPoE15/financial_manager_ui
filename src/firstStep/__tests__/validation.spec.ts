import { describe, expect, it } from 'vitest'

import { AMOUNT_RANGE_ERROR, parseAmount, validateName } from '@/firstStep/validation'

describe('validateName', () => {
  it('обычное имя проходит, пробелы по краям обрезаются', () => {
    expect(validateName('  Артём  ')).toEqual({ value: 'Артём' })
  })

  it('пустое имя и имя только из пробелов отклоняются', () => {
    expect(validateName('')).toEqual({ error: 'Введите имя' })
    expect(validateName(' \t ')).toEqual({ error: 'Введите имя' })
  })

  it('не длиннее 64 символов Unicode (после обрезки пробелов)', () => {
    expect(validateName('я'.repeat(64))).toEqual({ value: 'я'.repeat(64) })
    expect(validateName(` ${'я'.repeat(64)} `)).toEqual({ value: 'я'.repeat(64) })
    expect(validateName('😀'.repeat(64))).toEqual({ value: '😀'.repeat(64) })
    expect(validateName('я'.repeat(65))).toEqual({ error: 'Не длиннее 64 символов' })
  })

  it('управляющие символы отклоняются', () => {
    expect(validateName('Ар\u0000тём')).toEqual({ error: 'Имя содержит недопустимые символы' })
    expect(validateName('Ар\nтём')).toEqual({ error: 'Имя содержит недопустимые символы' })
    expect(validateName('Ар\u007ftём')).toEqual({ error: 'Имя содержит недопустимые символы' })
  })
})

describe('parseAmount', () => {
  it('целое число рублей', () => {
    expect(parseAmount('120000')).toEqual({ value: 120000 })
    expect(parseAmount('0')).toEqual({ value: 0 })
  })

  it('пробелы-разделители (в том числе неразрывные) и пробелы по краям допустимы', () => {
    expect(parseAmount(' 1 200 000 ')).toEqual({ value: 1200000 })
    expect(parseAmount('1 200 000')).toEqual({ value: 1200000 })
  })

  it('отрицательная сумма (долг) допустима — с дефисом и со знаком минуса', () => {
    expect(parseAmount('-5 000')).toEqual({ value: -5000 })
    expect(parseAmount('−5 000')).toEqual({ value: -5000 })
    expect(parseAmount('- 5000')).toEqual({ value: -5000 })
  })

  it('границы: ±1 000 000 000 включительно', () => {
    expect(parseAmount('1 000 000 000')).toEqual({ value: 1_000_000_000 })
    expect(parseAmount('-1 000 000 000')).toEqual({ value: -1_000_000_000 })
    expect(parseAmount('1 000 000 001')).toEqual({ error: AMOUNT_RANGE_ERROR })
    expect(parseAmount('-1 000 000 001')).toEqual({ error: AMOUNT_RANGE_ERROR })
    expect(parseAmount('99999999999999999999')).toEqual({ error: AMOUNT_RANGE_ERROR })
  })

  it('пустая сумма', () => {
    expect(parseAmount('')).toEqual({ error: 'Введите сумму' })
    expect(parseAmount('   ')).toEqual({ error: 'Введите сумму' })
  })

  it('дробная сумма, буквы и лишние знаки отклоняются', () => {
    const error = 'Введите целое число рублей'
    expect(parseAmount('100,50')).toEqual({ error })
    expect(parseAmount('100.5')).toEqual({ error })
    expect(parseAmount('1e6')).toEqual({ error })
    expect(parseAmount('сто')).toEqual({ error })
    expect(parseAmount('+100')).toEqual({ error })
    expect(parseAmount('--100')).toEqual({ error })
    expect(parseAmount('-')).toEqual({ error })
  })

  it('«−0» считается нулём', () => {
    expect(parseAmount('-0')).toEqual({ value: 0 })
  })
})
