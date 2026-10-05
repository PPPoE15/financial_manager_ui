import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import ErrorMessage from '@/components/ui/ErrorMessage.vue'

describe('ErrorMessage', () => {
  it('показывает текст ошибки с role="alert"', () => {
    const wrapper = mount(ErrorMessage, { props: { message: 'Неверный пароль' } })

    expect(wrapper.get('[role="alert"]').text()).toBe('Неверный пароль')
  })

  it('ничего не выводит без сообщения', () => {
    for (const message of [undefined, null, '']) {
      const wrapper = mount(ErrorMessage, { props: { message } })

      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    }
  })
})
