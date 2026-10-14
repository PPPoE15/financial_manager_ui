import { describe, expect, it } from 'vitest'

import { parsePlan, validateCategoryName, validateDescription } from '@/categories/validation'

describe('validateCategoryName', () => {
  it('обрезает пробелы по краям', () => {
    expect(validateCategoryName('  Продукты \t')).toEqual({ value: 'Продукты' })
  })

  it.each(['', '   '])('пустое название — ошибка (%j)', (input) => {
    expect(validateCategoryName(input)).toEqual({ error: 'Введите название' })
  })

  it('64 символа — можно, 65 — нельзя (считаются символы, а не UTF-16)', () => {
    expect(validateCategoryName('я'.repeat(64))).toEqual({ value: 'я'.repeat(64) })
    expect(validateCategoryName('😀'.repeat(64))).toEqual({ value: '😀'.repeat(64) })
    expect(validateCategoryName('я'.repeat(65))).toEqual({ error: 'Не длиннее 64 символов' })
  })

  it('управляющие символы — ошибка', () => {
    expect(validateCategoryName('Еда\u0000')).toEqual({
      error: 'Название содержит недопустимые символы',
    })
  })
})

describe('parsePlan', () => {
  it.each([
    ['', null],
    ['   ', null],
    ['0', 0],
    ['4990', 4990],
    ['11 500', 11500],
    ['200 000', 200000],
    ['1 000 000 000', 1_000_000_000],
  ])('%j → %j', (input, value) => {
    expect(parsePlan(input)).toEqual({ value })
  })

  it.each(['1.5', '1,5', 'abc', '-1', '−5'])(
    'не целое неотрицательное число — ошибка (%j)',
    (input) => {
      expect(parsePlan(input)).toEqual({ error: 'Введите целое число рублей не меньше 0' })
    },
  )

  it('больше 1 000 000 000 — ошибка', () => {
    expect(parsePlan('1000000001')).toEqual({
      error: 'План — не больше 1 000 000 000 ₽',
    })
  })
})

describe('validateDescription', () => {
  it('пустой комментарий — null, текст сохраняется как есть', () => {
    expect(validateDescription('')).toEqual({ value: null })
    expect(validateDescription('  Кафе ')).toEqual({ value: '  Кафе ' })
  })

  it('500 символов — можно, 501 — нельзя', () => {
    expect(validateDescription('д'.repeat(500))).toEqual({ value: 'д'.repeat(500) })
    expect(validateDescription('д'.repeat(501))).toEqual({ error: 'Не длиннее 500 символов' })
  })

  it('табуляция допустима, другие управляющие символы — нет', () => {
    expect(validateDescription('а\tб')).toEqual({ value: 'а\tб' })
    expect(validateDescription('а\u001bб')).toEqual({
      error: 'Комментарий содержит недопустимые символы',
    })
  })
})
