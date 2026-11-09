import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import UpcomingPlansCard from '../UpcomingPlansCard.vue'
import PlanDialog from '../PlanDialog.vue'
import { loadUpcomingPlans } from '@/api/plannedOperations'
import { plan } from '@/plans/__tests__/fixtures'
import type { PlannedOperationList } from '@/types/plannedOperation'
import { PLANNED_OPERATIONS_ROUTE } from '@/router/names'

vi.mock(
  '@/api/plannedOperations',
  /** Изолирует HTTP, сохраняя настоящий компонент и его обработчики. */ () => ({
    loadUpcomingPlans: vi.fn(),
  }),
)
let wrapper: VueWrapper
/** Возвращает полный серверный снимок ближайших планов. */
function snapshot(today = '2026-11-09'): PlannedOperationList {
  return {
    content: [
      plan('past', { planned_date: '2026-11-08' }),
      plan('today'),
      plan('future', {
        planned_date: '2026-11-10',
        transaction_type: 'income',
        category: { uid: 'c2', name: 'Зарплата' },
      }),
    ],
    total: 3,
    due_count: 2,
    next_skip: null,
    today,
    timezone: 'Europe/Moscow',
  }
}
/** Подключает настоящий маршрутизатор и заменяет только уже проверенное окно действий. */
async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      {
        path: '/planned-operations',
        name: PLANNED_OPERATIONS_ROUTE,
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/')
  wrapper = mount(UpcomingPlansCard, { global: { plugins: [router], stubs: { PlanDialog: true } } })
  await flushPromises()
  return router
}
beforeEach(
  /** Сбрасывает ответы API перед независимым сценарием. */ () => {
    vi.mocked(loadUpcomingPlans).mockReset().mockResolvedValue(snapshot())
  },
)
afterEach(
  /** Снимает обработчики и восстанавливает реальные часы. */ () => {
    wrapper?.unmount()
    vi.useRealTimers()
  },
)
it('показывает будущие планы и серверную подсветку, заголовок ведёт в список', /** Ловит ошибочную фильтрацию по дате и локальному календарю. */ async () => {
  const router = await render()
  expect(wrapper.findAll('[data-plan-uid]')).toHaveLength(3)
  expect(wrapper.get('[data-plan-uid="past"]').text()).toContain('Просрочено')
  expect(wrapper.get('[data-plan-uid="today"]').text()).toContain('Сегодня')
  expect(wrapper.get('[data-plan-uid="future"]').text()).toContain('+10')
  expect(wrapper.get('[data-plan-uid="future"]').text()).not.toContain('Сегодня')
  expect(wrapper.text()).not.toMatch(/Доход|Расход/)
  await wrapper.get('h2 a').trigger('click')
  await flushPromises()
  expect(router.currentRoute.value.name).toBe(PLANNED_OPERATIONS_ROUTE)
})
it('обновляет серверный день по таймеру и фокусу без редактирования плана', /** Снимает будущую подсветку на основании нового ответа сервера. */ async () => {
  vi.useFakeTimers()
  await render()
  vi.mocked(loadUpcomingPlans).mockResolvedValue(snapshot('2026-11-10'))
  await vi.advanceTimersByTimeAsync(60000)
  await flushPromises()
  expect(wrapper.get('[data-plan-uid="future"]').text()).toContain('Сегодня')
  vi.mocked(loadUpcomingPlans).mockResolvedValue(snapshot('2026-11-11'))
  window.dispatchEvent(new Event('focus'))
  await flushPromises()
  expect(wrapper.get('[data-plan-uid="future"]').text()).toContain('Просрочено')
})
it('не подменяет свежие данные запоздавшим ответом', /** Защищает обновление после мутации от старого фонового запроса. */ async () => {
  let resolve!: (data: PlannedOperationList) => void
  vi.mocked(loadUpcomingPlans).mockReturnValueOnce(
    new Promise(
      /** Удерживает первый запрос. */ (done) => {
        resolve = done
      },
    ),
  )
  await render()
  window.dispatchEvent(new Event('focus'))
  await flushPromises()
  resolve({ ...snapshot(), content: [] })
  await flushPromises()
  expect(wrapper.findAll('[data-plan-uid]')).toHaveLength(3)
})
it('показывает загрузку, ошибку, явный повтор и пустой список', /** Не выдаёт сбой HTTP за отсутствие планов. */ async () => {
  let reject!: (reason: Error) => void
  vi.mocked(loadUpcomingPlans).mockReturnValueOnce(
    new Promise(
      /** Удерживает запрос до сетевой ошибки. */ (_resolve, fail) => {
        reject = fail
      },
    ),
  )
  await render()
  expect(wrapper.get('[role="status"]').text()).toContain('Загрузка')
  reject(new Error('network'))
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось')
  vi.mocked(loadUpcomingPlans).mockResolvedValue({
    ...snapshot(),
    content: [],
    total: 0,
    due_count: 0,
  })
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('Запланированных операций пока нет')
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
})
it('передаёт общий диалог, обновляет блок и отчёты, поддерживает повторный план и переход к факту', /** Проверяет продолжение цепочки после подтверждения из главной. */ async () => {
  await render()
  await wrapper.get('[data-plan-uid="today"] button').trigger('click')
  await flushPromises()
  let dialog = wrapper.getComponent(PlanDialog)
  expect(dialog.props()).toMatchObject({
    mode: 'confirm',
    plan: { uid: 'today' },
    today: '2026-11-09',
  })
  vi.mocked(loadUpcomingPlans).mockResolvedValue({
    ...snapshot(),
    content: [plan('future', { planned_date: '2026-11-12' })],
  })
  dialog.vm.$emit('changed')
  await flushPromises()
  expect(wrapper.emitted('changed')).toHaveLength(1)
  expect(wrapper.findAll('[data-plan-uid]')).toHaveLength(1)
  const completed = plan('today', { status: 'completed', transaction_uid: 'fact' })
  dialog.vm.$emit('clone', completed)
  await flushPromises()
  dialog = wrapper.getComponent(PlanDialog)
  expect(dialog.props()).toMatchObject({ mode: 'create', plan: completed })
  dialog.vm.$emit('remove', completed)
  await flushPromises()
  dialog = wrapper.getComponent(PlanDialog)
  expect(dialog.props('mode')).toBe('delete')
  dialog.vm.$emit('openTransaction', completed)
  await flushPromises()
  expect(wrapper.findComponent(PlanDialog).exists()).toBe(false)
  expect(wrapper.emitted('openTransaction')?.[0]).toEqual([completed])
})
it('перенос использует общее окно и сохраняет будущий план среди ближайших', /** Не удаляет перенесённый план локальным фильтром. */ async () => {
  await render()
  await wrapper.get('[data-plan-uid="today"]').findAll('button')[1]!.trigger('click')
  await flushPromises()
  const dialog = wrapper.getComponent(PlanDialog)
  expect(dialog.props('mode')).toBe('reschedule')
  vi.mocked(loadUpcomingPlans).mockResolvedValue({
    ...snapshot(),
    content: [plan('today', { planned_date: '2026-12-01' })],
  })
  dialog.vm.$emit('changed')
  dialog.vm.$emit('close')
  await flushPromises()
  expect(wrapper.get('[data-plan-uid="today"]').text()).not.toContain('Сегодня')
  expect(wrapper.get('[data-plan-uid="today"]').text()).toContain('01.12.2026')
})
