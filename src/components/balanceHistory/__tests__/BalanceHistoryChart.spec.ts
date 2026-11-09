import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BalanceHistoryChart from '../BalanceHistoryChart.vue'

/** Проверяет доступные значения и геометрию графика. */
describe('График остатка', () => {
  /** Не соединяет неизвестные дни и сохраняет известные суммы. */
  it('разрывает линию на null и показывает точные значения при наведении и фокусе', async () => {
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
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
    const dots = wrapper.findAll('[data-point-index]')
    await dots[1]!.trigger('mouseenter')
    expect(wrapper.get('[role="tooltip"]').text()).toContain('02.10.2026')
    expect(wrapper.get('[role="tooltip"]').text()).toContain('0\u00a0₽')
    await wrapper.get('[data-testid="balance-plot"]').trigger('mouseleave')
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
    await dots[2]!.trigger('focus')
    expect(wrapper.get('[role="tooltip"]').text()).toContain('−1\u00a0000\u00a0₽')
    await dots[2]!.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
    await dots[2]!.trigger('blur')
  })

  /** Проверяет один Tab-вход и переход стрелками через известные точки, пропуская null. */
  it('перемещает фокус стрелками, Home/End и закрывает подсказку при выходе', async () => {
    const wrapper = mount(BalanceHistoryChart, {
      attachTo: document.body,
      props: {
        points: [
          { date: '2026-10-01', balance: null },
          { date: '2026-10-02', balance: 0 },
          { date: '2026-10-03', balance: null },
          { date: '2026-10-04', balance: -7 },
          { date: '2026-10-05', balance: 10 },
        ],
      },
    })
    try {
      expect(wrapper.findAll('[tabindex="0"]')).toHaveLength(1)
      const dots = wrapper.findAll<SVGElement>('[data-point-index]')
      dots[0]!.element.focus()
      await dots[0]!.trigger('keydown', { key: 'ArrowRight' })
      expect(document.activeElement).toBe(dots[1]!.element)
      expect(wrapper.get('[role="tooltip"]').text()).toContain('−7\u00a0₽')
      expect(dots[1]!.attributes('tabindex')).toBe('0')
      await dots[1]!.trigger('keydown', { key: 'End' })
      expect(document.activeElement).toBe(dots[2]!.element)
      await dots[2]!.trigger('keydown', { key: 'ArrowLeft' })
      expect(document.activeElement).toBe(dots[1]!.element)
      await dots[1]!.trigger('keydown', { key: 'Home' })
      expect(document.activeElement).toBe(dots[0]!.element)
      dots[0]!.element.blur()
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
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
    expect(wrapper.get('[data-point-index]').attributes('aria-label')).not.toContain('неизвестен')
  })
})
