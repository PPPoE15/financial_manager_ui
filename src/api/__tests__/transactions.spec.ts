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

describe('API редактора', /** Проверяет маршруты и контракт пакетных операций. */ () => {
  it('загружает страницу с точными фильтрами и отдельную запись', /** Проверяет query и сохранение метаданных страницы. */ async () => {
    const api = await import('@/api/transactions')
    const params = {
      transaction_type: 'outcome' as const,
      category_uid: 'c',
      after: '2026-01-01T00:00:00',
      before: '2026-01-31T23:59:59.999999',
      sort: '-transaction_date' as const,
      skip: 20,
      limit: 20,
    }
    const page = { total: 50, next_skip: 40, content: [] }
    const get = vi.spyOn(http, 'get').mockResolvedValue({ data: page })
    expect(await api.fetchTransactions(params)).toEqual(page)
    expect(get).toHaveBeenCalledWith('/transactions', { params, signal: undefined })
    await api.getTransaction('one')
    expect(get).toHaveBeenLastCalledWith('/transactions/one')
  })
  it('сохраняет одним PATCH и возвращает каждый результат удаления', /** Проверяет версии, payload и распаковку ответов. */ async () => {
    const api = await import('@/api/transactions')
    const items = [{ uid: 'one', expected_version: 3, changes: { description: null } }]
    const patch = vi
      .spyOn(http, 'patch')
      .mockResolvedValue({ data: { content: [{ uid: 'one', version: 4 }] } })
    expect(await api.saveTransactions(items)).toEqual([{ uid: 'one', version: 4 }])
    expect(patch).toHaveBeenCalledWith('/transactions/batch', { items })
    const results = [{ index: 0, uid: 'one', status: 409, code: 'FM-409204', message: 'Конфликт' }]
    const post = vi.spyOn(http, 'post').mockResolvedValue({ data: { results } })
    expect(await api.deleteTransactions([{ uid: 'one', expected_version: 3 }])).toEqual(results)
    expect(post).toHaveBeenCalledWith('/transactions/batch-delete', {
      items: [{ uid: 'one', expected_version: 3 }],
    })
  })
})
