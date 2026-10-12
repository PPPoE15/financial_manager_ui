import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import { getStartingBalance } from '@/api/balance'
import { getBudgetStructure } from '@/api/budget'
import BudgetStructureCard from '@/components/budget/BudgetStructureCard.vue'
import FirstStepDialog from '@/components/firstStep/FirstStepDialog.vue'
import { useSessionStore } from '@/stores/session'
import HomeView from '@/views/HomeView.vue'

vi.mock('@/api/budget', () => ({ getBudgetStructure: vi.fn() }))
vi.mock('@/api/balance', () => ({ getStartingBalance: vi.fn(), createStartingBalance: vi.fn() }))

describe('HomeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
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

  it('подключает окно «Первый шаг»', () => {
    expect(mount(HomeView).findComponent(FirstStepDialog).exists()).toBe(true)
  })
})
