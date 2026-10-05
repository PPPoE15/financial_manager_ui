import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import BaseInput from '@/components/ui/BaseInput.vue'

describe('BaseInput', () => {
  it('связывает подпись с полем ввода', () => {
    const wrapper = mount(BaseInput, {
      props: { label: 'Электронная почта', placeholder: 'name@example.com' },
    })

    const label = wrapper.get('label')
    const input = wrapper.get('input')
    expect(label.text()).toBe('Электронная почта')
    expect(input.attributes('id')).toBeTruthy()
    expect(label.attributes('for')).toBe(input.attributes('id'))
    expect(input.attributes('placeholder')).toBe('name@example.com')
  })

  it('поддерживает v-model', async () => {
    const wrapper = mount(BaseInput, { props: { label: 'Пароль', modelValue: 'old' } })
    const input = wrapper.get('input')

    expect(input.element.value).toBe('old')
    await input.setValue('new')

    expect(wrapper.emitted('update:modelValue')).toEqual([['new']])
  })

  it('передаёт тип и прочие атрибуты в input', () => {
    const wrapper = mount(BaseInput, {
      props: { label: 'Пароль', type: 'password' },
      attrs: { autocomplete: 'current-password', required: true },
    })

    const input = wrapper.get('input')
    expect(input.attributes('type')).toBe('password')
    expect(input.attributes('autocomplete')).toBe('current-password')
    expect(input.attributes('required')).toBeDefined()
  })

  it('без ошибки не показывает сообщение и не помечает поле', () => {
    const wrapper = mount(BaseInput, { props: { label: 'Пароль' } })

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('input').attributes('aria-invalid')).toBeUndefined()
  })

  it('показывает ошибку и связывает её с полем', () => {
    const wrapper = mount(BaseInput, { props: { label: 'Пароль', error: 'Введите пароль' } })

    const input = wrapper.get('input')
    const error = wrapper.get('[role="alert"]')
    expect(error.text()).toBe('Введите пароль')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toBe(error.attributes('id'))
  })
})
