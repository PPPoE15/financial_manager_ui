import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PlanDialog from '../PlanDialog.vue'
vi.mock(
  '@/api/categories',
  /** Возвращает пустой список категорий для теста фокуса. */ () => ({
    listCategories: vi.fn().mockResolvedValue([]),
  }),
)
describe('Окно планирования', /** Проверяет доступность и нейтральные подписи. */ () => {
  it('изолирует фон, закрывается Escape и возвращает фокус', /** Проверяет реальный Teleport. */ async () => {
    const app = document.createElement('div')
    app.id = 'app'
    document.body.append(app)
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const wrapper = mount(PlanDialog, {
      attachTo: app,
      props: { mode: 'create', today: '2026-11-09' },
    })
    await flushPromises()
    expect(app.hasAttribute('inert')).toBe(true)
    const dialog = document.querySelector('[role="dialog"]')!
    expect(dialog.textContent).toContain('Запланировать операцию')
    expect(dialog.textContent).not.toContain('Расход')
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
    expect(app.hasAttribute('inert')).toBe(false)
    expect(document.activeElement).toBe(opener)
    app.remove()
    opener.remove()
  })
})

vi.mock('@/api/plannedOperations')
import * as api from '@/api/plannedOperations'
import { plan } from '@/plans/__tests__/fixtures'
it('скрывает переход при удалении факта после открытия деталей', /** Перечитывает связь вместо открытия устаревшего UID. */ async () => {
  const completed = plan('p', { status: 'completed', transaction_state: 'available', transaction_uid: 't' })
  vi.mocked(api.readPlan).mockResolvedValueOnce(completed).mockResolvedValueOnce({ ...completed, transaction_state: 'deleted', transaction_uid: null, version: 3 })
  vi.mocked(api.readPlanTransaction).mockResolvedValueOnce({ uid: 't', version: 1, transaction_date: '2026-11-09T00:00:00', money_sum: 10, category: { uid: 'c', name: 'ЖКХ' }, transaction_type: 'outcome', description: null }).mockRejectedValueOnce({ response: { status: 404 } })
  const wrapper = mount(PlanDialog, { attachTo: document.body, props: { mode: 'details', plan: completed, today: '2026-11-09' } })
  await flushPromises()
  const button = [...document.querySelectorAll('button')].find(/** Находит переход к фактической записи. */ b => b.textContent?.includes('Открыть фактическую'))!
  button.click(); await flushPromises()
  expect(wrapper.emitted('openTransaction')).toBeUndefined()
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Фактическая операция удалена')
  wrapper.unmount()
})
