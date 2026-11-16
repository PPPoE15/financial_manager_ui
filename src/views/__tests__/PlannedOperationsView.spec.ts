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
      routes: [
        { path: '/', name: 'planned-operations', component: PlannedOperationsView },
        { path: '/regular', name: 'regular-operations', component: PlannedOperationsView },
      ],
    })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(PlannedOperationsView, { global: { plugins: [router] } })
    await flushPromises()
    expect(wrapper.text()).toContain('Сегодня')
    expect(api.loadPlans).toHaveBeenCalledWith(
      { include_completed: false, include_regular: true },
      expect.any(AbortSignal),
    )
    await wrapper.get('[data-edit="amount"]').trigger('click')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(wrapper.find('input[inputmode="numeric"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Сохранить')
    await wrapper.get('[data-plan-menu]').trigger('click')
    expect(wrapper.get('[data-plan-menu-items]').text()).toContain('Удалить план')
    wrapper.unmount()
  })
})

it('показывает сохранённое имя категории выполненного плана', /** Не подменяет снимок последующим переименованием категории. */ async () => {
  vi.mocked(api.loadPlans).mockResolvedValue({
    content: [plan('p', { status: 'completed', category: { uid: 'c', name: 'Исходное имя' } })],
    total: 1,
    due_count: 0,
    next_skip: null,
    today: '2026-11-09',
    timezone: 'Europe/Moscow',
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'planned-operations', component: PlannedOperationsView },
      { path: '/regular', name: 'regular-operations', component: PlannedOperationsView },
    ],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(PlannedOperationsView, { global: { plugins: [router] } })
  await flushPromises()
  expect(wrapper.get('[data-plan-uid="p"]').text()).toContain('Исходное имя')
  wrapper.unmount()
})

it('пропускает переход на вход при незавершённом редактировании', /** Защита черновика не блокирует окончание сессии. */ async () => {
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
    routes: [
      { path: '/', name: 'planned-operations', component: PlannedOperationsView },
      { path: '/regular', name: 'regular-operations', component: PlannedOperationsView },
      { path: '/login', name: 'login', component: { template: '<p>Вход</p>' } },
    ],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
  await flushPromises()
  await wrapper.get('[data-edit="amount"]').trigger('click')
  await router.push({ name: 'login' })
  expect(router.currentRoute.value.name).toBe('login')
  wrapper.unmount()
})

it('сочетает показ регулярных с типом и выполнением', /** Проверяет серверные фильтры списка. */ async () => {
  vi.mocked(api.loadPlans).mockResolvedValue({
    content: [],
    total: 0,
    due_count: 0,
    next_skip: null,
    today: '2026-11-09',
    timezone: 'Europe/Moscow',
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'planned-operations', component: PlannedOperationsView },
      { path: '/regular', name: 'regular-operations', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  const wrapper = mount(PlannedOperationsView, { global: { plugins: [router] } })
  try {
    await flushPromises()
    const regular = wrapper.get<HTMLInputElement>('input[name="include-regular"]')
    expect(regular.element.checked).toBe(true)
    await regular.setValue(false)
    await wrapper.get<HTMLInputElement>('input[name="include-completed"]').setValue(true)
    await wrapper
      .findAll('button')
      .find(/** Выбирает фильтр доходов. */ (button) => button.text() === 'Доходы')!
      .trigger('click')
    expect(api.loadPlans).toHaveBeenLastCalledWith(
      { include_completed: true, include_regular: false, transaction_type: 'income' },
      expect.any(AbortSignal),
    )
  } finally {
    wrapper.unmount()
  }
})
