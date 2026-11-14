import { describe, expect, it, vi } from 'vitest'
import { http } from '@/api/client'
import {
  loadPlans,
  loadUpcomingPlans,
  createPlan,
  updatePlan,
  deletePlan,
  confirmPlan,
  readPlanTransaction,
} from '@/api/plannedOperations'

describe('Контракт планов', /** Проверяет пагинацию и отсутствие повторных мутаций. */ () => {
  it('читает next_skip, объединяет по UID и передаёт фильтры', /** Обрабатывает повтор строки при конкурентном сдвиге страниц. */ async () => {
    const get = vi
      .spyOn(http, 'get')
      .mockResolvedValueOnce({
        data: {
          content: [{ uid: 'a', planned_date: '2026-11-10' }],
          next_skip: 1,
          today: '2026-11-09',
          total: 2,
          due_count: 0,
        },
      })
      .mockResolvedValueOnce({
        data: {
          content: [
            { uid: 'a', planned_date: '2026-11-10' },
            { uid: 'b', planned_date: '2026-11-09' },
          ],
          next_skip: null,
          today: '2026-11-09',
        },
      })
    const result = await loadPlans({ transaction_type: 'income', include_completed: true })
    expect(result.content.map(/** Извлекает порядок идентификаторов. */ (p) => p.uid)).toEqual([
      'b',
      'a',
    ])
    expect(get.mock.calls[1]).toEqual([
      '/planned-operations',
      {
        params: { transaction_type: 'income', include_completed: true, skip: 1, limit: 500 },
        signal: undefined,
      },
    ])
  })
  it('не повторяет создание или подтверждение после сетевого сбоя', /** Не создаёт дубликат автоматически. */ async () => {
    const post = vi.spyOn(http, 'post').mockRejectedValue(new Error('network'))
    await expect(
      createPlan({
        planned_date: '2026-11-10',
        money_sum: 1,
        category_uid: 'c',
        description: null,
      }),
    ).rejects.toThrow('network')
    await expect(
      confirmPlan('p', {
        expected_version: 1,
        transaction_date: '2026-11-01T00:00:00',
        money_sum: 1,
        category_uid: 'c',
        description: null,
      }),
    ).rejects.toThrow('network')
    expect(post).toHaveBeenCalledTimes(2)
  })
  it('передаёт версию удаления и PATCH и читает факт отдельным GET', /** Соблюдает контракт точечных действий. */ async () => {
    const patch = vi.spyOn(http, 'patch').mockResolvedValue({ data: {} })
    const del = vi.spyOn(http, 'delete').mockResolvedValue({})
    const get = vi.spyOn(http, 'get').mockResolvedValue({ data: {} })
    await updatePlan('p', { expected_version: 2, description: null })
    await deletePlan('p', 2)
    await readPlanTransaction('t')
    expect(patch).toHaveBeenCalledWith('/planned-operations/p', {
      expected_version: 2,
      description: null,
    })
    expect(del).toHaveBeenCalledWith('/planned-operations/p', { params: { expected_version: 2 } })
    expect(get).toHaveBeenCalledWith('/transactions/t')
  })
})

it('запрашивает только четыре ближайших невыполненных плана без ограничения даты', /** Не загружает весь список или только наступившие записи. */ async () => {
  const get = vi.spyOn(http, 'get').mockResolvedValue({
    data: {
      content: [],
      total: 10,
      due_count: 2,
      next_skip: 4,
      today: '2026-11-10',
      timezone: 'Europe/Moscow',
    },
  })
  const controller = new AbortController()
  const result = await loadUpcomingPlans(controller.signal)
  expect(get).toHaveBeenCalledExactlyOnceWith('/planned-operations', {
    params: { include_completed: false, include_regular: true, limit: 4, skip: 0 },
    signal: controller.signal,
  })
  expect(result.next_skip).toBe(4)
})
