import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import { useSessionStore } from '@/stores/session'
import HomeView from '@/views/HomeView.vue'

describe('HomeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('приветствует пользователя по имени', () => {
    useSessionStore().setUser({ uid: 'u', name: 'Артём', email: 'a@example.com' })

    expect(mount(HomeView).get('h1').text()).toBe('Добрый день, Артём')
  })

  it('без загруженного пользователя приветствует без имени', () => {
    expect(mount(HomeView).get('h1').text()).toBe('Добрый день')
  })
})
