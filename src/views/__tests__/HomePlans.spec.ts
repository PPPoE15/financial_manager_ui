import { expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import HomeView from '../HomeView.vue'
import UpcomingPlansCard from '@/components/plans/UpcomingPlansCard.vue'
import PlanDialog from '@/components/plans/PlanDialog.vue'
import TransactionListDialog from '@/components/transactions/TransactionListDialog.vue'
import { loadUpcomingPlans } from '@/api/plannedOperations'
import { listTransactions } from '@/api/transactions'
import { getBudgetStructure } from '@/api/budget'
import { getBalanceHistory } from '@/api/balanceHistory'
import { plan } from '@/plans/__tests__/fixtures'
import { PLANNED_OPERATIONS_ROUTE } from '@/router/names'
vi.mock(
  '@/api/plannedOperations',
  /** Изолирует сервер ближайших планов. */ () => ({ loadUpcomingPlans: vi.fn() }),
)
vi.mock(
  '@/api/transactions',
  /** Изолирует запросы фактических операций. */ () => ({ listTransactions: vi.fn() }),
)
vi.mock('@/api/budget', /** Изолирует бюджетный отчёт. */ () => ({ getBudgetStructure: vi.fn() }))
vi.mock(
  '@/api/balanceHistory',
  /** Изолирует историю баланса. */ () => ({ getBalanceHistory: vi.fn() }),
)
it('обновляет реальные карточки отчётов после действия с планом и открывает связанный факт', /** Ловит отсутствие связи виджета с главной. */ async () => {
  vi.mocked(loadUpcomingPlans).mockResolvedValue({
    content: [plan()],
    total: 1,
    due_count: 1,
    next_skip: null,
    today: '2026-11-09',
    timezone: 'Europe/Moscow',
  })
  vi.mocked(listTransactions).mockResolvedValue([])
  vi.mocked(getBudgetStructure).mockReturnValue(
    new Promise(/** Оставляет загрузку отчёта незавершённой. */ () => {}),
  )
  vi.mocked(getBalanceHistory).mockReturnValue(
    new Promise(/** Оставляет загрузку графика незавершённой. */ () => {}),
  )
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      {
        path: '/planned-operations',
        name: PLANNED_OPERATIONS_ROUTE,
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/')
  const wrapper = mount(HomeView, {
    global: {
      plugins: [createPinia(), router],
      stubs: { FirstStepDialog: true, PlanDialog: true, TransactionListDialog: true },
    },
  })
  await flushPromises()
  const widget = wrapper.findComponent(UpcomingPlansCard)
  expect(widget.exists()).toBe(true)
  await widget.get('[data-plan-uid] button').trigger('click')
  await flushPromises()
  vi.mocked(listTransactions).mockClear()
  vi.mocked(getBudgetStructure).mockClear()
  vi.mocked(getBalanceHistory).mockClear()
  widget.getComponent(PlanDialog).vm.$emit('changed')
  await flushPromises()
  expect(listTransactions).toHaveBeenCalledWith('income')
  expect(listTransactions).toHaveBeenCalledWith('outcome')
  expect(getBudgetStructure).toHaveBeenCalledTimes(1)
  expect(getBalanceHistory).toHaveBeenCalledTimes(1)
  widget
    .getComponent(PlanDialog)
    .vm.$emit('openTransaction', plan('p', { transaction_uid: 'fact' }))
  await flushPromises()
  expect(wrapper.getComponent(TransactionListDialog).props()).toMatchObject({
    type: 'outcome',
    initialUid: 'fact',
  })
  wrapper.unmount()
})
