import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { http } from '@/api/client'
import BalanceHistoryCard from '../BalanceHistoryCard.vue'

/** Восстанавливает HTTP после каждого сценария. */
afterEach(() => vi.restoreAllMocks())
/** Создаёт полный ответ API для состояний карточки. */
function response(balance: number | null) {
  return {
    data: {
      date_from: '2026-10-01',
      date_to: '2026-10-01',
      currency: 'RUB',
      unit: 'rubles',
      timezone: 'Europe/Moscow',
      points: [{ date: '2026-10-01', balance }],
    },
  }
}
/** Проверяет пользовательские состояния карточки. */
describe('Карточка динамики финансов', () => {
  /** Отличает неизвестный диапазон от известного нуля и сохраняет поля дат. */
  it('показывает загрузку, неизвестный диапазон и график после смены дат', async () => {
    vi.spyOn(http, 'get').mockResolvedValueOnce(response(null)).mockResolvedValue(response(0))
    const wrapper = mount(BalanceHistoryCard)
    expect(wrapper.text()).toContain('Загрузка')
    await flushPromises()
    expect(wrapper.text()).toContain('Остаток за выбранный период неизвестен')
    expect(wrapper.find('svg').exists()).toBe(false)
    await wrapper.get('input[type="date"]').setValue('2026-10-01')
    await flushPromises()
    expect(wrapper.find('svg').exists()).toBe(true)
    await wrapper.get('[data-point-index]').trigger('focus')
    expect(wrapper.get('[role="tooltip"]').text()).toContain('0\u00a0₽')
    await wrapper.get('input[type="date"]').setValue('')
    expect(wrapper.find('[role="alert"]').text()).not.toBe('')
    expect(wrapper.find('svg').exists()).toBe(false)
    wrapper.unmount()
  })
  /** Предлагает существующее окно при отсутствии стартового остатка. */
  it('предлагает задать стартовый остаток при FM-409203', async () => {
    vi.spyOn(http, 'get').mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { code: 'FM-409203' } },
    })
    const wrapper = mount(BalanceHistoryCard)
    await flushPromises()
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('set-balance')).toHaveLength(1)
    wrapper.unmount()
  })
  /** Позволяет повторить запрос после сетевой ошибки. */
  it('повторяет загрузку после ошибки', async () => {
    vi.spyOn(http, 'get')
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(response(-5))
    const wrapper = mount(BalanceHistoryCard)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).not.toBe('')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    await wrapper.get('[data-point-index]').trigger('focus')
    expect(wrapper.get('[role="tooltip"]').text()).toContain('−5\u00a0₽')
    wrapper.unmount()
  })
})
