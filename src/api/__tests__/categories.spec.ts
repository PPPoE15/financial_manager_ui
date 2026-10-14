import { describe, expect, it, vi } from 'vitest'

import { createCategory, listCategories } from '@/api/categories'
import { http } from '@/api/client'
import type { Category } from '@/types/category'

const category: Category = {
  uid: '3a6c3f0e-8f1b-4b8e-9f43-2a1d6b2c9e10',
  name: 'еда вне дома',
  money_plan: 5000,
  category_type: 'outcome',
  description: 'Кафе и доставка',
}

describe('API статей', () => {
  it('listCategories отправляет GET /categories с типом и лимитом 100 и возвращает статьи', async () => {
    const get = vi.spyOn(http, 'get').mockResolvedValue({ data: { total: 1, content: [category] } })

    await expect(listCategories('outcome')).resolves.toEqual([category])

    expect(get).toHaveBeenCalledWith('/categories', {
      params: { category_type: 'outcome', limit: 100 },
    })
  })

  it('createCategory отправляет POST /categories и возвращает созданную статью', async () => {
    const post = vi.spyOn(http, 'post').mockResolvedValue({ data: category })
    const body = { name: 'еда вне дома', money_plan: null, category_type: 'income' as const }

    await expect(createCategory(body)).resolves.toEqual(category)

    expect(post).toHaveBeenCalledWith('/categories', body)
  })
})
