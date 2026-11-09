import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as api from '@/api/plannedOperations'
import { usePlans } from '@/plans/usePlans'
import { plan } from './fixtures'
vi.mock('@/api/plannedOperations')
beforeEach(
  /** Устанавливает начальный ответ сервера. */ () => {
    vi.mocked(api.loadPlans).mockResolvedValue({
      content: [plan(), plan('q')],
      today: '2026-11-09',
      timezone: 'Europe/Moscow',
      total: 2,
      due_count: 2,
      next_skip: null,
    })
  },
)
describe('Редактор планов', /** Проверяет частичное сохранение и защиту версий. */ () => {
  it('сохраняет успешную строку и оставляет неуспешную в черновике', /** Не повторяет уже сохранённый PATCH. */ async () => {
    const state = usePlans()
    await state.load()
    state.edit(plan(), 'amount', '15')
    state.edit(plan('q'), 'description', 'Правка')
    vi.mocked(api.updatePlan)
      .mockResolvedValueOnce(plan('p', { money_sum: 15, version: 2 }))
      .mockRejectedValueOnce({
        response: {
          status: 422,
          data: { validation: [{ field: 'description', message: 'Ошибка' }] },
        },
      })
    await state.save()
    expect(state.drafts.value.p).toBeUndefined()
    expect(state.drafts.value.q?.draft.description).toBe('Правка')
    expect(state.drafts.value.q?.errors.description).toBe('Ошибка')
    expect(api.updatePlan).toHaveBeenCalledWith('p', { expected_version: 1, money_sum: 15 })
  })
  it('не обновляет базовую версию при фоновом чтении или конфликте', /** Требует явной сверки перед перезаписью. */ async () => {
    const state = usePlans()
    await state.load()
    state.edit(plan(), 'amount', '20')
    vi.mocked(api.updatePlan).mockRejectedValue({ response: { status: 409 } })
    vi.mocked(api.readPlan).mockResolvedValue(plan('p', { version: 2, money_sum: 30 }))
    await state.save()
    expect(state.drafts.value.p?.base.version).toBe(1)
    expect(state.drafts.value.p?.current?.version).toBe(2)
    expect(state.drafts.value.p?.draft.amount).toBe('20')
    await state.save()
    expect(api.updatePlan).toHaveBeenCalledTimes(1)
    state.acceptCurrent('p')
    expect(state.drafts.value.p?.base.version).toBe(2)
    expect(state.drafts.value.p?.draft.amount).toBe('20')
  })
  it('отмена не отправляет запрос и отрицательная вставка не меняет черновик', /** Сохраняет явно введённое положительное значение. */ async () => {
    const state = usePlans()
    await state.load()
    state.edit(plan(), 'amount', '-200')
    expect(state.drafts.value.p?.draft.amount).toBe('10')
    state.cancel()
    expect(state.drafts.value).toEqual({})
    expect(api.updatePlan).not.toHaveBeenCalled()
  })
})
