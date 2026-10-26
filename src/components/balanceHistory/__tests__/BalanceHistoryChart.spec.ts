import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BalanceHistoryChart from '../BalanceHistoryChart.vue'

/** Проверяет доступные значения и геометрию графика. */
describe('График остатка', () => {
  /** Не соединяет неизвестные дни и сохраняет известные суммы. */
  it('разрывает линию на null и показывает точные значения через выбор дня', async () => {
    const wrapper = mount(BalanceHistoryChart, {
      props: {
        points: [
          { date: '2026-10-01', balance: 10 },
          { date: '2026-10-02', balance: 0 },
          { date: '2026-10-03', balance: null },
          { date: '2026-10-04', balance: -1000 },
          { date: '2026-10-05', balance: -2000 },
        ],
      },
    })
    expect(wrapper.findAll('[data-testid="balance-line"]')).toHaveLength(2)
    expect(wrapper.findAll('circle')).toHaveLength(4)
    await wrapper.get('select').setValue('2026-10-02')
    expect(wrapper.get('output').text()).toContain('0\u00a0₽')
    await wrapper.get('select').setValue('2026-10-03')
    expect(wrapper.get('output').text()).toContain('Остаток неизвестен')
    await wrapper.get('select').setValue('2026-10-04')
    expect(wrapper.get('output').text()).toContain('−1\u00a0000\u00a0₽')
    expect(wrapper.get('select').attributes('aria-label')).toBeTruthy()
  })
  /** Один день и постоянная линия не вызывают деления на ноль. */
  it.each([
    { balances: [0] },
    { balances: [-1000, -1000] },
    { balances: [0, 0] },
    { balances: [9_999_999_999, 9_999_999_999] },
  ])('отображает известные остатки $balances', ({ balances }) => {
    const wrapper = mount(BalanceHistoryChart, {
      props: {
        points: balances.map(
          /** Создаёт последовательные календарные дни. */
          (balance, index) => ({ date: `2026-10-0${index + 1}`, balance }),
        ),
      },
    })
    expect(wrapper.findAll('circle')).toHaveLength(balances.length)
    expect(wrapper.get('svg').html()).not.toMatch(/NaN|Infinity/)
    expect(wrapper.get('output').text()).not.toContain('неизвестен')
  })
})
