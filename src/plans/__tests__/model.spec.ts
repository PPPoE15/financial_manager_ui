import { describe, expect, it } from 'vitest'
import { acceptAmount, draftFromPlan, validateDraft } from '@/plans/model'

describe('Черновик плана', /** Проверяет правила ввода и независимость исходных данных. */ () => {
  it('отвергает отрицательную вставку целиком и разрешает целые рубли', /** Сохраняет прежний ввод при недопустимых символах. */ () => {
    expect(acceptAmount('123', '-45')).toBe('123')
    expect(acceptAmount('123', '−45')).toBe('123')
    expect(acceptAmount('', '1 250')).toBe('1250')
    expect(acceptAmount('123', '1.2')).toBe('123')
  })
  it('проверяет итоговую дату даже при изменении только суммы', /** Применяет серверный календарь ко всему PATCH. */ () => {
    expect(
      validateDraft(
        { date: '2026-11-08', amount: '15', category: 'c', description: '' },
        '2026-11-09',
      ).date,
    ).toBeTruthy()
    expect(
      validateDraft(
        { date: '2026-11-08', amount: '15', category: 'c', description: '' },
        '2026-11-09',
        true,
      ),
    ).toEqual({})
    expect(
      validateDraft(
        { date: '2026-02-30', amount: '0', category: '', description: 'a'.repeat(501) },
        '2026-11-09',
        true,
      ),
    ).toHaveProperty('date')
  })
  it('копирует исходную дату, сумму, категорию и комментарий', /** Не заменяет прошедшую дату клона сегодняшней. */ () => {
    expect(
      draftFromPlan({
        planned_date: '2026-11-07',
        money_sum: 11500,
        category: { uid: 'c', name: 'ЖКХ' },
        description: 'Исходный',
      }),
    ).toEqual({ date: '2026-11-07', amount: '11500', category: 'c', description: 'Исходный' })
  })
})
