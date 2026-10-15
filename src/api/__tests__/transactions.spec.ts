import { describe, expect, it, vi } from 'vitest'
import { http } from '@/api/client'
import { listTransactions } from '@/api/transactions'

describe('API недавних транзакций', () => {
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
