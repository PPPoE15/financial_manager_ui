import { describe, expect, it, vi } from 'vitest'
import { http } from '@/api/client'
import { createTransaction, listTransactions } from '@/api/transactions'

describe('API недавних транзакций', () => {
  it.each(['income', 'outcome'] as const)(
    'создаёт запись типа %s и возвращает ответ сервера',
    async (type) => {
      const body = {
        transaction_date: '2026-10-15T09:08:07',
        category_uid: 'category',
        money_sum: 123,
        transaction_type: type,
        description: null,
      }
      const result = { uid: 'created', ...body, category: { uid: 'category', name: 'Статья' } }
      const post = vi.spyOn(http, 'post').mockResolvedValue({ data: result })
      await expect(createTransaction(body)).resolves.toEqual(result)
      expect(post).toHaveBeenCalledWith('/transactions', body)
    },
  )
  it('передаёт ошибку создания вызывающему коду', async () => {
    const error = new Error('Сеть недоступна')
    vi.spyOn(http, 'post').mockRejectedValue(error)
    await expect(
      createTransaction({
        transaction_date: '2026-10-15T09:08:07',
        category_uid: 'c',
        money_sum: 1,
        transaction_type: 'income',
        description: null,
      }),
    ).rejects.toBe(error)
  })
  it.each(['income', 'outcome'] as const)(
    'запрашивает пять последних записей типа %s',
    async (type) => {
      const content = [{ uid: 'latest' }, { uid: 'older' }]
      const get = vi.spyOn(http, 'get').mockResolvedValue({ data: { total: 12, content } })
      await expect(listTransactions(type)).resolves.toEqual(content)
      expect(get).toHaveBeenCalledWith('/transactions', {
        params: { transaction_type: type, limit: 5, sort: '-transaction_date' },
      })
    },
  )
  it('передаёт ошибку вызывающему коду', async () => {
    const error = new Error('Сеть недоступна')
    vi.spyOn(http, 'get').mockRejectedValue(error)
    await expect(listTransactions('income')).rejects.toBe(error)
  })
})
