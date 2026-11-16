import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import BaseButton from '@/components/ui/BaseButton.vue'

describe('BaseButton', () => {
  it('выводит содержимое слота и по умолчанию имеет type="button"', () => {
    const wrapper = mount(BaseButton, { slots: { default: 'Войти' } })

    expect(wrapper.text()).toBe('Войти')
    expect(wrapper.attributes('type')).toBe('button')
  })

  it('принимает type="submit"', () => {
    const wrapper = mount(BaseButton, { props: { type: 'submit' } })

    expect(wrapper.attributes('type')).toBe('submit')
  })

  it('генерирует click', async () => {
    const wrapper = mount(BaseButton)

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('в состоянии disabled не генерирует click', async () => {
    const wrapper = mount(BaseButton, { props: { disabled: true } })

    await wrapper.trigger('click')

    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('во время загрузки заблокирована и помечена aria-busy', async () => {
    const wrapper = mount(BaseButton, { props: { loading: true } })

    await wrapper.trigger('click')

    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.emitted('click')).toBeUndefined()
  })
})
