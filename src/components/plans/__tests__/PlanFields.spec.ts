import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PlanFields from '../PlanFields.vue'
describe('Поля плана', /** Проверяет блокировку минуса до изменения отображаемого значения. */ () => {
  it('блокирует клавишу и отрицательную вставку, не меняет поле', /** Не превращает отрицательную сумму в положительную. */ async () => {
    const wrapper = mount(PlanFields, {
      props: {
        modelValue: { date: '2026-11-09', amount: '100', category: 'c', description: '' },
        categories: [],
        today: '2026-11-09',
        errors: {},
      },
    })
    const amount = wrapper.get('input[inputmode="numeric"]')
    const key = new KeyboardEvent('keydown', { key: '-', cancelable: true, bubbles: true })
    amount.element.dispatchEvent(key)
    expect(key.defaultPrevented).toBe(true)
    await amount.setValue('-20')
    expect((amount.element as HTMLInputElement).value).toBe('100')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })
})
