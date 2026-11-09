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
