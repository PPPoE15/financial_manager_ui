import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import PlannedOperationsView from '../PlannedOperationsView.vue'
import * as api from '@/api/plannedOperations'
import { plan } from '@/plans/__tests__/fixtures'
vi.mock('@/api/plannedOperations')
vi.mock(
  '@/api/categories',
  /** Возвращает категории для редактирования. */ () => ({
    listCategories: vi
      .fn()
      .mockResolvedValue([{ uid: 'c', name: 'ЖКХ', category_type: 'outcome' }]),
  }),
)
describe('Список планов', /** Проверяет отдельный экран и встроенное редактирование. */ () => {
  it('подсвечивает наступившие и редактирует без модального окна', /** Проверяет доступные действия строки. */ async () => {
    vi.mocked(api.loadPlans).mockResolvedValue({
      content: [plan()],
      total: 1,
      due_count: 1,
      next_skip: null,
      today: '2026-11-09',
      timezone: 'Europe/Moscow',
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: PlannedOperationsView }],
    })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(PlannedOperationsView, { global: { plugins: [router] } })
    await flushPromises()
    expect(wrapper.text()).toContain('Сегодня')
    expect(api.loadPlans).toHaveBeenCalledWith(
      { include_completed: false },
      expect.any(AbortSignal),
    )
    await wrapper.get('[data-edit="amount"]').trigger('click')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(wrapper.find('input[inputmode="numeric"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Сохранить')
    await wrapper.get('[data-plan-menu]').trigger('click')
    expect(wrapper.get('[data-plan-menu-items]').text()).toBe('Удалить план')
    wrapper.unmount()
  })
})

it('показывает сохранённое имя категории выполненного плана', /** Не подменяет снимок последующим переименованием категории. */ async () => {
  vi.mocked(api.loadPlans).mockResolvedValue({ content: [plan('p', { status: 'completed', category: { uid: 'c', name: 'Исходное имя' } })], total: 1, due_count: 0, next_skip: null, today: '2026-11-09', timezone: 'Europe/Moscow' })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: PlannedOperationsView }] })
  await router.push('/'); await router.isReady()
  const wrapper = mount(PlannedOperationsView, { global: { plugins: [router] } })
  await flushPromises()
  expect(wrapper.get('[data-plan-uid="p"]').text()).toContain('Исходное имя')
  wrapper.unmount()
})
