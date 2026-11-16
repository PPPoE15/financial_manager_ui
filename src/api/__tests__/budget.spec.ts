import { describe, expect, it, vi } from 'vitest'

import { getBudgetStructure } from '@/api/budget'
import { http } from '@/api/client'

describe('API структуры бюджета', () => {
  it('getBudgetStructure отправляет GET /budget-structure с годом и типом статей', async () => {
    const table = { year: 2026, category_type: 'income', rows: [], total: {} }
    const get = vi.spyOn(http, 'get').mockResolvedValue({ data: table })

    await expect(getBudgetStructure(2026, 'income')).resolves.toEqual(table)

    expect(get).toHaveBeenCalledWith('/budget-structure', {
      params: { year: 2026, category_type: 'income' },
    })
  })
})
