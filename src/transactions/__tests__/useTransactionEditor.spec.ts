import { describe, expect, it, vi, beforeEach } from 'vitest'
import { saveTransactions, deleteTransactions, getTransaction } from '@/api/transactions'
import { useTransactionEditor } from '../useTransactionEditor'
import { transaction, deferred } from './fixtures'
import type { Transaction } from '@/types/transaction'
vi.mock(
  '@/api/transactions',
  /** Подменяет только запросы сервера. */ () => ({
    saveTransactions: vi.fn(),
    deleteTransactions: vi.fn(),
    getTransaction: vi.fn(),
  }),
)
beforeEach(/** Очищает историю запросов. */ () => vi.resetAllMocks())
/** Создаёт редактор с наблюдаемыми обновлениями отчётов. */
function editor() {
  const refresh = vi.fn().mockResolvedValue(undefined)
  const onChanged = vi.fn()
  return { ...useTransactionEditor({ refresh, onChanged }), refresh, onChanged }
}
/** Создаёт ошибку API с индексом строки. */
function failure(status: number) {
  return {
    response: {
      status,
      data: {
        errors: [
          {
            index: 0,
            uid: 'one',
            field: 'expected_version',
            message: 'Версия операции изменилась',
          },
        ],
      },
    },
  }
}
describe('Пакетный редактор', /** Проверяет атомарность и сохранность ввода. */ () => {
  it('сохраняет все правки одним запросом и не повторяет нажатие', /** Проверяет блокировку и подтверждённый результат записи. */ async () => {
    const e = editor()
    e.ingest([transaction(), transaction('two')])
    e.edit('one', 'description', '')
    e.edit('two', 'amount', '100')
    const pending = deferred<Transaction[]>()
    vi.mocked(saveTransactions).mockReturnValue(pending.promise)
    const saving = e.save()
    expect(await e.save()).toBe(false)
    expect(saveTransactions).toHaveBeenCalledExactlyOnceWith([
      { uid: 'one', expected_version: 3, changes: { description: null } },
      { uid: 'two', expected_version: 3, changes: { money_sum: 100 } },
    ])
    pending.resolve([
      transaction('one', { description: null, version: 4 }),
      transaction('two', { money_sum: 100, version: 4 }),
    ])
    expect(await saving).toBe(true)
    expect(e.dirty.value).toHaveLength(0)
    expect(e.onChanged).toHaveBeenCalledTimes(1)
    expect(await e.save()).toBe(true)
    expect(saveTransactions).toHaveBeenCalledTimes(1)
  })
  it('блокирует 101 правку без разбиения и сохраняет невалидный ввод', /** Проверяет лимиты перед сетевой записью. */ async () => {
    const e = editor()
    for (let i = 0; i < 101; i++) {
      e.ingest([transaction(String(i))])
      e.edit(String(i), 'amount', '10')
    }
    expect(await e.save()).toBe(false)
    expect(saveTransactions).not.toHaveBeenCalled()
    e.discard('100')
    e.edit('0', 'amount', '0')
    expect(await e.save()).toBe(false)
    expect(e.draftsByUid.value.get('0')?.errors.amount).toBeTruthy()
    expect(e.draftsByUid.value.get('0')?.values.amount).toBe('0')
  })
  it.each([422, 413, 409, 404, 500])(
    'сохраняет ввод при %s',
    /** Проверяет ошибки и запрет автоматической замены версии. */ async (status) => {
      const e = editor()
      e.ingest([transaction()])
      e.edit('one', 'amount', '200')
      vi.mocked(saveTransactions).mockRejectedValue(failure(status))
      expect(await e.save()).toBe(false)
      e.ingest([transaction('one', { version: 8, money_sum: 300 })])
      expect(e.draftsByUid.value.get('one')?.values.amount).toBe('200')
      expect(e.draftsByUid.value.get('one')?.original.version).toBe(3)
      expect(saveTransactions).toHaveBeenCalledTimes(1)
      expect(e.message.value).toBeTruthy()
    },
  )
  it('после неизвестного результата требует сверки до повторной записи', /** Проверяет явный перенос правок на свежую версию. */ async () => {
    const e = editor()
    e.ingest([transaction()])
    e.edit('one', 'amount', '200')
    vi.mocked(saveTransactions).mockRejectedValue(new Error('network'))
    await e.save()
    await e.save()
    expect(saveTransactions).toHaveBeenCalledTimes(1)
    vi.mocked(getTransaction).mockResolvedValue(transaction('one', { version: 4, money_sum: 300 }))
    await e.reconcile('one')
    expect(e.draftsByUid.value.get('one')?.original.version).toBe(3)
    e.reapplyDraft('one')
    expect(e.draftsByUid.value.get('one')?.original.version).toBe(4)
    expect(e.draftsByUid.value.get('one')?.values.amount).toBe('200')
  })
  it('частично удаляет только успешные строки, остальные сохраняет', /** Проверяет разбор каждого результата HTTP 200. */ async () => {
    const e = editor()
    e.ingest([transaction(), transaction('two'), transaction('three')])
    for (const uid of ['one', 'two', 'three']) e.edit(uid, 'amount', '200')
    vi.mocked(deleteTransactions).mockResolvedValue([
      { index: 0, uid: 'one', status: 204 },
      { index: 1, uid: 'two', status: 404, code: 'FM-404000', message: 'Не найдена' },
      { index: 2, uid: 'three', status: 409, code: 'FM-409204', message: 'Конфликт' },
    ])
    await e.remove(['one', 'two', 'three'])
    expect(e.draftsByUid.value.has('one')).toBe(false)
    expect(e.draftsByUid.value.get('two')?.values.amount).toBe('200')
    expect(e.draftsByUid.value.get('three')?.errors.row).toBe('Конфликт')
    expect(e.onChanged).toHaveBeenCalledTimes(1)
  })
  it('не считает невалидный ответ подтверждением удаления', /** Проверяет неизвестный результат неполного ответа. */ async () => {
    const e = editor()
    e.ingest([transaction()])
    e.edit('one', 'amount', '200')
    vi.mocked(deleteTransactions).mockResolvedValue([])
    await e.remove(['one'])
    expect(e.draftsByUid.value.has('one')).toBe(true)
    expect(e.unresolved.value.has('one')).toBe(true)
  })
  it('сбой перечитывания после сохранения не возвращает старый черновик', /** Разделяет успешную запись и неуспешное чтение. */ async () => {
    const e = editor()
    e.ingest([transaction()])
    e.edit('one', 'amount', '200')
    vi.mocked(saveTransactions).mockResolvedValue([
      transaction('one', { money_sum: 200, version: 4 }),
    ])
    e.refresh.mockRejectedValue(new Error('network'))
    expect(await e.save()).toBe(true)
    expect(e.dirty.value).toHaveLength(0)
  })
})
