import { describe, expect, it, vi } from 'vitest'
import * as api from '@/api/plannedOperations'
import { usePlanAction } from '@/plans/usePlanAction'
import { plan } from './fixtures'
vi.mock('@/api/plannedOperations')
vi.mock(
  '@/api/categories',
  /** Предоставляет доступную категорию. */ () => ({
    listCategories: vi
      .fn()
      .mockResolvedValue([{ uid: 'c', name: 'ЖКХ', category_type: 'outcome' }]),
  }),
)
vi.mock(
  '@/api/transactions',
  /** Изолирует обновление фактического списка. */ () => ({
    listTransactions: vi.fn().mockResolvedValue([]),
  }),
)
vi.mock(
  '@/api/balanceHistory',
  /** Изолирует обновление баланса. */ () => ({ getBalanceHistory: vi.fn().mockResolvedValue({}) }),
)
describe('Действия над планом', /** Проверяет восстановление неопределённого результата. */ () => {
  it('сохраняет черновик создания после сбоя и не повторяет POST', /** Требует нового явного действия пользователя. */ async () => {
    const action = usePlanAction('create', undefined, '2026-11-09')
    await action.load()
    action.draft.value = {
      date: '2026-11-10',
      amount: '100',
      category: 'c',
      description: 'Черновик',
    }
    vi.mocked(api.createPlan).mockRejectedValue(new Error('network'))
    await action.submit()
    expect(api.createPlan).toHaveBeenCalledTimes(1)
    expect(action.draft.value.description).toBe('Черновик')
    expect(action.message.value).toContain('Проверьте список')
    expect(action.success.value).toBe(false)
  })
  it('после потерянного ответа подтверждения показывает прочитанный факт', /** Не считает локальные поля фактическими данными. */ async () => {
    vi.mocked(api.readPlan)
      .mockResolvedValueOnce(plan())
      .mockResolvedValueOnce(
        plan('p', {
          status: 'completed',
          version: 2,
          transaction_uid: 't',
          transaction_state: 'available',
        }),
      )
    vi.mocked(api.confirmPlan).mockRejectedValue(new Error('network'))
    vi.mocked(api.readPlanTransaction).mockResolvedValue({
      uid: 't',
      version: 1,
      transaction_date: '2026-11-08T00:00:00',
      money_sum: 9,
      category: { uid: 'c', name: 'ЖКХ' },
      transaction_type: 'outcome',
      description: 'Факт',
    })
    const action = usePlanAction('confirm', plan(), '2026-11-09')
    await action.load()
    action.draft.value.amount = '15'
    await action.submit()
    expect(action.current.value?.status).toBe('completed')
    expect(action.transaction.value?.money_sum).toBe(9)
    expect(action.draft.value.amount).toBe('15')
    expect(api.confirmPlan).toHaveBeenCalledTimes(1)
    await action.submit()
    expect(api.confirmPlan).toHaveBeenCalledTimes(1)
  })
})

describe('Версии и удаление в формах', /** Проверяет защиту повторных действий и удалённую связь. */ () => {
  it('передаёт только дату при переносе', /** Не перезаписывает остальные поля плана. */ async () => {
    vi.mocked(api.readPlan).mockResolvedValue(plan())
    vi.mocked(api.updatePlan).mockResolvedValue(
      plan('p', { planned_date: '2026-11-12', version: 2 }),
    )
    const action = usePlanAction('reschedule', plan(), '2026-11-09')
    await action.load()
    action.draft.value.date = '2026-11-12'
    await action.submit()
    expect(api.updatePlan).toHaveBeenCalledWith('p', {
      expected_version: 1,
      planned_date: '2026-11-12',
    })
    expect(action.success.value).toBe(true)
  })
  it('после конфликта удаления требует явного принятия новой версии', /** Не удаляет изменившийся план прежним намерением. */ async () => {
    vi.mocked(api.readPlan)
      .mockResolvedValueOnce(plan())
      .mockResolvedValueOnce(plan('p', { version: 2 }))
    vi.mocked(api.deletePlan)
      .mockRejectedValueOnce({ response: { status: 409 } })
      .mockResolvedValueOnce(undefined)
    const action = usePlanAction('delete', plan(), '2026-11-09')
    await action.load()
    await action.submit()
    await action.submit()
    expect(api.deletePlan).toHaveBeenCalledTimes(1)
    action.acceptCurrent()
    await action.submit()
    expect(api.deletePlan).toHaveBeenLastCalledWith('p', 2)
  })
  it('не запрашивает факт при удалённой связи', /** Оставляет исходный план выполненным. */ async () => {
    vi.mocked(api.readPlan).mockResolvedValue(
      plan('p', { status: 'completed', transaction_state: 'deleted' }),
    )
    const action = usePlanAction('details', plan(), '2026-11-09')
    await action.load()
    expect(action.completed.value).toBe(true)
    expect(action.transaction.value).toBeNull()
    expect(api.readPlanTransaction).not.toHaveBeenCalled()
  })
  it('не создаёт второй запрос до завершения первого', /** Защищает от двойного нажатия подтверждения. */ async () => {
    vi.mocked(api.readPlan).mockResolvedValue(plan())
    let finish!: (value: Awaited<ReturnType<typeof api.confirmPlan>>) => void
    vi.mocked(api.confirmPlan).mockImplementation(
      /** Удерживает первый запрос до явного завершения тестом. */ () =>
        new Promise(
          /** Сохраняет обработчик ответа сервера. */ (resolve) => {
            finish = resolve
          },
        ),
    )
    const action = usePlanAction('confirm', plan(), '2026-11-09')
    await action.load()
    const first = action.submit()
    await action.submit()
    expect(api.confirmPlan).toHaveBeenCalledTimes(1)
    finish({
      plan: plan('p', { status: 'completed' }),
      transaction: {
        uid: 't',
        version: 1,
        transaction_date: '2026-11-09T00:00:00',
        money_sum: 10,
        category: { uid: 'c', name: 'ЖКХ' },
        transaction_type: 'outcome',
        description: null,
      },
    })
    await first
    expect(action.success.value).toBe(true)
  })
})

it('не разрешает повтор после неизвестного результата и неудачного GET', /** Требует успешного чтения и явного решения перед новым запросом. */ async () => {
  vi.mocked(api.readPlan).mockResolvedValueOnce(plan()).mockRejectedValueOnce(new Error('GET failed'))
  vi.mocked(api.confirmPlan).mockRejectedValue(new Error('POST unknown'))
  const action = usePlanAction('confirm', plan(), '2026-11-09')
  await action.load(); await action.submit()
  expect(action.needsDecision.value).toBe(true)
  action.acceptCurrent(); await action.submit()
  expect(api.confirmPlan).toHaveBeenCalledTimes(1)
  vi.mocked(api.readPlan).mockResolvedValue(plan())
  await action.reconcile(); action.acceptCurrent(); await action.submit()
  expect(api.confirmPlan).toHaveBeenCalledTimes(2)
})
