import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import { getStartingBalance } from '@/api/balance'
import { listTransactions } from '@/api/transactions'
import RecentTransactionsCard from '@/components/transactions/RecentTransactionsCard.vue'
import { getBudgetStructure } from '@/api/budget'
import BudgetStructureCard from '@/components/budget/BudgetStructureCard.vue'
import CategoryEditorDialog from '@/components/categories/CategoryEditorDialog.vue'
import FirstStepDialog from '@/components/firstStep/FirstStepDialog.vue'
import { useSessionStore } from '@/stores/session'
import HomeView from '@/views/HomeView.vue'

vi.mock('@/api/transactions', () => ({ listTransactions: vi.fn() }))
vi.mock('@/api/budget', () => ({ getBudgetStructure: vi.fn() }))
vi.mock('@/api/balance', () => ({ getStartingBalance: vi.fn(), createStartingBalance: vi.fn() }))

describe('HomeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(listTransactions).mockResolvedValue([])
    vi.mocked(getBudgetStructure).mockReturnValue(new Promise(() => {}))
    vi.mocked(getStartingBalance).mockReturnValue(new Promise(() => {}))
  })

  it('приветствует пользователя по имени', () => {
    useSessionStore().setUser({ uid: 'u', name: 'Артём', email: 'a@example.com' })

    expect(mount(HomeView).get('h1').text()).toBe('Добрый день, Артём')
  })

  it('без имени (до окна «Первый шаг») приветствует без запятой', () => {
    useSessionStore().setUser({ uid: 'u', name: null, email: 'a@example.com' })

    expect(mount(HomeView).get('h1').text()).toBe('Добрый день')
  })

  it('без загруженного пользователя приветствует без имени', () => {
    expect(mount(HomeView).get('h1').text()).toBe('Добрый день')
  })

  it('показывает таблицу «Структура бюджета»', () => {
    expect(mount(HomeView).findComponent(BudgetStructureCard).exists()).toBe(true)
  })

  it('подключает обе карточки недавних записей', () => {
    const cards = mount(HomeView).findAllComponents(RecentTransactionsCard)
    expect(cards.map((card) => card.props('type'))).toEqual(['income', 'outcome'])
  })

  it('обновляет названия статей в обеих карточках после сохранения редактора категорий', async () => {
    let name = 'Старая статья'
    vi.mocked(listTransactions).mockImplementation(async (type) => [
      {
        uid: type,
        transaction_date: '2026-10-15T12:00:00',
        category: { uid: 'category', name },
        money_sum: 100,
        transaction_type: type,
        description: null,
      },
    ])
    const wrapper = mount(HomeView, { global: { stubs: { CategoryEditorDialog: true } } })
    await flushPromises()
    const cards = wrapper.findAllComponents(RecentTransactionsCard)
    expect(cards.every((card) => card.text().includes('Старая статья'))).toBe(true)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Редактировать категории')!
      .trigger('click')
    name = 'Новое название'
    wrapper.findComponent(CategoryEditorDialog).vm.$emit('saved')
    await flushPromises()
    for (const card of cards) {
      expect(card.text()).toContain('Новое название')
      expect(card.text()).not.toContain('Старая статья')
    }
  })

  it('подключает окно «Первый шаг»', () => {
    expect(mount(HomeView).findComponent(FirstStepDialog).exists()).toBe(true)
  })
})
