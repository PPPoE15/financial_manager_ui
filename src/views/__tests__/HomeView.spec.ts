import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import { getBudgetStructure } from '@/api/budget'
import BudgetStructureCard from '@/components/budget/BudgetStructureCard.vue'
import { useSessionStore } from '@/stores/session'
import HomeView from '@/views/HomeView.vue'

vi.mock('@/api/budget', () => ({ getBudgetStructure: vi.fn() }))

describe('HomeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(getBudgetStructure).mockReturnValue(new Promise(() => {}))
  })

  it('приветствует пользователя по имени', () => {
    useSessionStore().setUser({ uid: 'u', name: 'Артём', email: 'a@example.com' })

    expect(mount(HomeView).get('h1').text()).toBe('Добрый день, Артём')
  })

  it('без загруженного пользователя приветствует без имени', () => {
    expect(mount(HomeView).get('h1').text()).toBe('Добрый день')
  })

  it('показывает таблицу «Структура бюджета»', () => {
    expect(mount(HomeView).findComponent(BudgetStructureCard).exists()).toBe(true)
  })
})
