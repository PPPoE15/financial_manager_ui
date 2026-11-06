import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fetchTransactions } from '@/api/transactions'
import { useTransactionList } from '../useTransactionList'
import { deferred, transaction } from './fixtures'
import type { TransactionList } from '@/types/transaction'
vi.mock(
  '@/api/transactions',
  /** Подменяет только сетевую границу. */ () => ({ fetchTransactions: vi.fn() }),
)
beforeEach(/** Сбрасывает ответы API между сценариями. */ () => vi.resetAllMocks())
describe('Подгрузка операций', /** Проверяет страницы и гонки ответов. */ () => {
  it('вычисляет два экрана и использует next_skip, исключая повтор UID', /** Проверяет серверное смещение и завершение списка. */ async () => {
    const api = vi.mocked(fetchTransactions)
    api.mockResolvedValueOnce({ content: [transaction()], total: 2, next_skip: 20 })
    api.mockResolvedValueOnce({
      content: [transaction(), transaction('two')],
      total: 2,
      next_skip: null,
    })
    const list = useTransactionList()
    await list.loadInitial(400, 40)
    expect(api.mock.calls[0]?.[0]).toMatchObject({
      skip: 0,
      limit: 20,
      transaction_type: 'outcome',
    })
    list.toggleAllLoaded()
    await list.loadMore()
    expect(api.mock.calls[1]?.[0].skip).toBe(20)
    expect(list.records.value.map(/** Читает идентификатор строки. */ (row) => row.uid)).toEqual([
      'one',
      'two',
    ])
    expect([...list.selectedUids.value]).toEqual(['one'])
    await list.loadMore()
    expect(api).toHaveBeenCalledTimes(2)
  })
  it('не дублирует подгрузку и сохраняет список после ошибки', /** Проверяет повтор без сброса имеющихся строк. */ async () => {
    const api = vi.mocked(fetchTransactions)
    api.mockResolvedValueOnce({ content: [transaction()], total: 2, next_skip: 1 })
    const list = useTransactionList()
    await list.loadInitial(10, 40)
    const request = deferred<TransactionList>()
    api.mockReturnValueOnce(request.promise)
    const pending = list.loadMore()
    await list.loadMore()
    request.reject(new Error('network'))
    await pending
    expect(list.records.value).toHaveLength(1)
    expect(list.loadError.value).toBeTruthy()
    expect(list.nextSkip.value).toBe(1)
    api.mockResolvedValueOnce({ content: [transaction('two')], total: 2, next_skip: null })
    await list.loadMore()
    expect(list.records.value).toHaveLength(2)
    expect(api).toHaveBeenCalledTimes(3)
  })
  it('игнорирует поздний ответ старого фильтра', /** Проверяет смену поколения запросов. */ async () => {
    const api = vi.mocked(fetchTransactions)
    const old = deferred<TransactionList>()
    api.mockReturnValueOnce(old.promise)
    const list = useTransactionList()
    const first = list.loadInitial(400, 40)
    api.mockResolvedValueOnce({ content: [transaction('income')], total: 1, next_skip: null })
    await list.setFilters({ transaction_type: 'income', sort: 'transaction_date' })
    old.resolve({ content: [transaction('old')], total: 99, next_skip: 50 })
    await first
    expect(list.records.value[0]?.uid).toBe('income')
    expect(list.total.value).toBe(1)
    expect(list.loading.value).toBe(false)
  })
})
