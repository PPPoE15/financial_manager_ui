import { describe, expect, it } from 'vitest'
import { createDraft, buildChanges, validateDraft } from '../editorModel'
import type { Transaction } from '@/types/transaction'

export const record: Transaction = {
  uid: 'one',
  version: 3,
  transaction_date: '2026-11-05T14:30:12.123456',
  category: { uid: 'food', name: 'Продукты' },
  money_sum: 2650,
  transaction_type: 'outcome',
  description: 'Покупки',
}

describe('Черновик операции', /** Проверяет нормализацию изменений без потери исходных данных. */ () => {
  it('отправляет только изменения и сохраняет исходное время/версию', /** Проверяет независимость черновика от исходной записи. */ () => {
    const draft = createDraft(record)
    expect(buildChanges(draft)).toEqual({})
    draft.values.date = '2026-10-01'
    draft.values.description = ''
    draft.values.amount = '2 650'
    expect(buildChanges(draft)).toEqual({ date: '2026-10-01', description: null })
    expect(draft.original.transaction_date).toBe('2026-11-05T14:30:12.123456')
    expect(draft.original.version).toBe(3)
    draft.values.date = '2026-11-05'
    draft.values.description = 'Покупки'
    expect(buildChanges(draft)).toEqual({})
  })
  it.each(['', '0', '1.5', '1000000001', '1e3', '-1'])(
    'отклоняет сумму %s',
    /** Проверяет недопустимую денежную строку. */ (amount) => {
      const draft = createDraft(record)
      draft.values.amount = amount
      expect(validateDraft(draft).amount).toBeTruthy()
    },
  )
  it.each(['1', '1 000 000 000'])(
    'принимает граничную сумму %s',
    /** Проверяет целые рубли без округления. */ (amount) => {
      const draft = createDraft(record)
      draft.values.amount = amount
      expect(validateDraft(draft)).toEqual({})
    },
  )
  it.each(['2025-02-29', '1999-12-31', '2100-01-01', '2026-04-31', ''])(
    'отклоняет дату %s',
    /** Проверяет календарь и контрактный диапазон. */ (date) => {
      const draft = createDraft(record)
      draft.values.date = date
      expect(validateDraft(draft).date).toBeTruthy()
    },
  )
  it('учитывает високосный день и Unicode-символы', /** Проверяет длину комментария в символах и запрет управляющих кодов. */ () => {
    const draft = createDraft(record)
    draft.values.date = '2024-02-29'
    draft.values.description = '😀'.repeat(500)
    expect(validateDraft(draft)).toEqual({})
    draft.values.description += 'я'
    expect(validateDraft(draft).description).toBeTruthy()
    draft.values.description = '\u0000'
    expect(validateDraft(draft).description).toBeTruthy()
  })
})
