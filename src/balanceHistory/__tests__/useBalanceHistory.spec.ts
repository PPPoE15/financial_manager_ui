import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, type EffectScope } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { http } from '@/api/client'
import { useBalanceHistory } from '../useBalanceHistory'

/** Создаёт полный ответ API с точками, которые нельзя пересчитывать. */
function response(balance: number | null = -7) {
  return {
    data: {
      date_from: '2026-10-25',
      date_to: '2026-10-26',
      currency: 'RUB',
      unit: 'rubles',
      timezone: 'Europe/Moscow',
      points: [
        { date: '2026-10-25', balance: null },
        { date: '2026-10-26', balance },
      ],
    },
  }
}
/** Создаёт ошибку на границе HTTP. */
function failure(status?: number, code?: string) {
  return { isAxiosError: true, ...(status && { response: { status, data: { code } } }) }
}
let scope: EffectScope
/** Управляет датой и временем каждого сценария. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-26T12:00:00Z'))
  scope = effectScope()
})
/** Освобождает реактивные наблюдатели и моки. */
afterEach(() => {
  scope.stop()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
/** Проверяет запросы и состояния отчёта. */
describe('Загрузка дневного остатка', () => {
  /** Защищает параметры контракта и отсутствие пересчёта сумм. */
  it('передаёт диапазон в API, сохраняет null и отрицательное значение', async () => {
    const get = vi.spyOn(http, 'get').mockResolvedValue(response())
    const state = scope.run(useBalanceHistory)!
    expect(state.loading.value).toBe(true)
    await flushPromises()
    expect(get).toHaveBeenCalledWith('/balance-history', {
      params: { date_from: '2026-10-13', date_to: '2026-10-26' },
    })
    expect(state.points.value).toEqual(response().data.points)
    state.from.value = '2026-10-25'
    await nextTick()
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith('/balance-history', {
      params: { date_from: '2026-10-25', date_to: '2026-10-26' },
    })
    expect(state.loading.value).toBe(false)
  })
  /** Старый запрос не вправе затирать результат нового диапазона. */
  it.each([false, true])('игнорирует устаревший ответ, ошибка=%s', async (rejectOld) => {
    let resolveOld!: (value: ReturnType<typeof response>) => void
    let reject!: (error: unknown) => void
    const old = new Promise<ReturnType<typeof response>>(
      /** Сохраняет управление первым запросом. */ (resolve, fail) => {
        resolveOld = resolve
        reject = fail
      },
    )
    vi.spyOn(http, 'get').mockReturnValueOnce(old).mockResolvedValue(response(0))
    const state = scope.run(useBalanceHistory)!
    state.from.value = '2026-10-25'
    await nextTick()
    await flushPromises()
    if (rejectOld) reject(failure(409, 'FM-409203'))
    else resolveOld(response(500))
    await flushPromises()
    expect(state.points.value[1]?.balance).toBe(0)
    expect(state.error.value).toBe('')
    expect(state.needsBalance.value).toBe(false)
  })
  /** Невалидный ввод сразу отменяет право старого запроса менять экран. */
  it('отклоняет неверный диапазон и игнорирует ответ в полёте', async () => {
    let resolve!: (value: ReturnType<typeof response>) => void
    const get = vi.spyOn(http, 'get').mockReturnValue(
      new Promise(
        /** Сохраняет управление ответом. */ (done) => {
          resolve = done
        },
      ),
    )
    const state = scope.run(useBalanceHistory)!
    state.to.value = '2026-10-27'
    await nextTick()
    expect(state.validation.value).not.toBe('')
    resolve(response())
    await flushPromises()
    expect(state.points.value).toEqual([])
    expect(state.loading.value).toBe(false)
    expect(get).toHaveBeenCalledTimes(1)
  })
  /** Восстанавливает отчёт после задания стартового остатка. */
  it('распознаёт только FM-409203 и повторно загружает после сохранения', async () => {
    vi.spyOn(http, 'get')
      .mockRejectedValueOnce(failure(409, 'FM-409203'))
      .mockResolvedValue(response())
    const state = scope.run(useBalanceHistory)!
    await flushPromises()
    expect(state.needsBalance.value).toBe(true)
    await state.reload()
    expect(state.needsBalance.value).toBe(false)
    expect(state.points.value[1]?.balance).toBe(-7)
  })
  /** Ошибки контракта и сети показываются с возможностью повтора. */
  it.each([
    [422, 'FM-422000'],
    [409, 'OTHER'],
    [undefined, undefined],
  ])('показывает ошибку %s и повторяет', async (status, code) => {
    vi.spyOn(http, 'get')
      .mockRejectedValueOnce(failure(status, code))
      .mockResolvedValue(response(0))
    const state = scope.run(useBalanceHistory)!
    await flushPromises()
    expect(state.error.value).not.toBe('')
    expect(state.needsBalance.value).toBe(false)
    await state.reload()
    expect(state.error.value).toBe('')
    expect(state.points.value[1]?.balance).toBe(0)
  })
})
