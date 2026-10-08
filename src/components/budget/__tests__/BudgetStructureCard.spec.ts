import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'

import { getBudgetStructure } from '@/api/budget'
import BudgetStructureCard from '@/components/budget/BudgetStructureCard.vue'
import type { BudgetStructure } from '@/types/budget'
import { budgetStructure } from './fixtures'

vi.mock('@/api/budget', () => ({ getBudgetStructure: vi.fn() }))

const api = vi.mocked(getBudgetStructure)

/** Промис, который тест разрешает или отклоняет сам — чтобы проверить состояние во время запроса. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function categoryNames(wrapper: VueWrapper): string[] {
  return wrapper.findAll('tbody th').map((th) => th.text())
}

function button(wrapper: VueWrapper, name: string) {
  const found = wrapper
    .findAll('button')
    .find((b) => b.text() === name || b.attributes('aria-label') === name)
  if (!found) throw new Error(`Нет кнопки «${name}»`)
  return found
}

async function mountLoaded(data: BudgetStructure = budgetStructure()) {
  api.mockResolvedValue(data)
  const wrapper = mount(BudgetStructureCard)
  await flushPromises()
  return wrapper
}

describe('BudgetStructureCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 2, 15))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('по умолчанию запрашивает расходы за текущий год', async () => {
    const wrapper = await mountLoaded()

    expect(api).toHaveBeenCalledTimes(1)
    expect(api).toHaveBeenCalledWith(2026, 'outcome')
    expect(wrapper.get('[data-testid="budget-year"]').text()).toBe('2026')
    expect(button(wrapper, 'Расходы').attributes('aria-pressed')).toBe('true')
    expect(button(wrapper, 'Доходы').attributes('aria-pressed')).toBe('false')
  })

  it('выводит заголовок карточки и таблицу из ответа', async () => {
    const wrapper = await mountLoaded()

    expect(wrapper.get('h2').text()).toBe('Мои категории')
    expect(wrapper.text()).toContain('Структура бюджета')
    expect(categoryNames(wrapper)).toEqual(['еда вне дома', 'подарки'])
  })

  it('во время загрузки показывает «Загрузка…» вместо таблицы', async () => {
    const request = deferred<BudgetStructure>()
    api.mockReturnValue(request.promise)
    const wrapper = mount(BudgetStructureCard)
    await flushPromises()

    expect(wrapper.get('[role="status"]').text()).toBe('Загрузка…')
    expect(wrapper.find('table').exists()).toBe(false)

    request.resolve(budgetStructure())
    await flushPromises()

    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.find('table').exists()).toBe(true)
  })

  it('при ошибке показывает сообщение и по «Повторить» запрашивает снова', async () => {
    api.mockRejectedValueOnce(new Error('сеть'))
    const wrapper = mount(BudgetStructureCard)
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Не удалось загрузить структуру бюджета')
    expect(wrapper.find('table').exists()).toBe(false)

    api.mockResolvedValueOnce(budgetStructure())
    await button(wrapper, 'Повторить').trigger('click')
    await flushPromises()

    expect(api).toHaveBeenCalledTimes(2)
    expect(api).toHaveBeenLastCalledWith(2026, 'outcome')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(categoryNames(wrapper)).toEqual(['еда вне дома', 'подарки'])
  })

  it('без статей расходов показывает пустое состояние', async () => {
    const wrapper = await mountLoaded(budgetStructure({ rows: [] }))

    expect(wrapper.text()).toContain('Статей расходов пока нет')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('без статей доходов показывает пустое состояние для доходов', async () => {
    const wrapper = await mountLoaded()
    api.mockResolvedValue(budgetStructure({ rows: [] }, 'income'))

    await button(wrapper, 'Доходы').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Статей доходов пока нет')
  })

  it('смена типа статей перезапрашивает таблицу', async () => {
    const wrapper = await mountLoaded()

    await button(wrapper, 'Доходы').trigger('click')
    await flushPromises()

    expect(api).toHaveBeenLastCalledWith(2026, 'income')
    expect(button(wrapper, 'Доходы').attributes('aria-pressed')).toBe('true')
  })

  it('повторный выбор того же типа не перезапрашивает таблицу', async () => {
    const wrapper = await mountLoaded()

    await button(wrapper, 'Расходы').trigger('click')
    await flushPromises()

    expect(api).toHaveBeenCalledTimes(1)
  })

  it('стрелки года перезапрашивают таблицу за предыдущий и следующий год', async () => {
    const wrapper = await mountLoaded()

    await button(wrapper, 'Предыдущий год').trigger('click')
    await flushPromises()
    expect(api).toHaveBeenLastCalledWith(2025, 'outcome')
    expect(wrapper.get('[data-testid="budget-year"]').text()).toBe('2025')

    await button(wrapper, 'Следующий год').trigger('click')
    await button(wrapper, 'Следующий год').trigger('click')
    await flushPromises()
    expect(api).toHaveBeenLastCalledWith(2027, 'outcome')
  })

  it('не выходит за границы годов контракта 2000–2099', async () => {
    vi.setSystemTime(new Date(2000, 0, 10))
    const first = await mountLoaded()
    expect(button(first, 'Предыдущий год').attributes('disabled')).toBeDefined()
    expect(button(first, 'Следующий год').attributes('disabled')).toBeUndefined()

    vi.setSystemTime(new Date(2099, 11, 31))
    const last = await mountLoaded()
    expect(button(last, 'Следующий год').attributes('disabled')).toBeDefined()
    expect(button(last, 'Предыдущий год').attributes('disabled')).toBeUndefined()
  })

  it('ответ на устаревший запрос не перетирает актуальный', async () => {
    const outdated = deferred<BudgetStructure>()
    const actual = deferred<BudgetStructure>()
    api.mockReturnValueOnce(outdated.promise).mockReturnValueOnce(actual.promise)
    const wrapper = mount(BudgetStructureCard)
    await flushPromises()

    await button(wrapper, 'Доходы').trigger('click')
    actual.resolve(
      budgetStructure(
        { rows: [{ ...budgetStructure().rows[0]!, category: { uid: 'i', name: 'зарплата' } }] },
        'income',
      ),
    )
    await flushPromises()
    outdated.resolve(budgetStructure())
    await flushPromises()

    expect(categoryNames(wrapper)).toEqual(['зарплата'])
  })

  it('ошибка устаревшего запроса не перетирает актуальную таблицу', async () => {
    const outdated = deferred<BudgetStructure>()
    api.mockReturnValueOnce(outdated.promise).mockResolvedValueOnce(budgetStructure())
    const wrapper = mount(BudgetStructureCard)
    await flushPromises()

    await button(wrapper, 'Предыдущий год').trigger('click')
    await flushPromises()
    outdated.reject(new Error('сеть'))
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(categoryNames(wrapper)).toEqual(['еда вне дома', 'подарки'])
  })
})
