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

it('различает одноимённые категории знаком операции', /** Не позволяет перепутать тип нового плана. */ () => {
  const wrapper = mount(PlanFields, { props: { modelValue: { date: '2026-11-09', amount: '', category: '', description: '' }, categories: [{ uid: 'i', name: 'Прочее', category_type: 'income', money_plan: null, description: null }, { uid: 'o', name: 'Прочее', category_type: 'outcome', money_plan: null, description: null }], today: '2026-11-09', errors: {} } })
  expect(wrapper.get('option[value="i"]').text()).toBe('+ Прочее')
  expect(wrapper.get('option[value="o"]').text()).toBe('− Прочее')
  wrapper.unmount()
})
