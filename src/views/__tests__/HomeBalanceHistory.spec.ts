import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { http } from '@/api/client'
import { useSessionStore } from '@/stores/session'
import HomeView from '../HomeView.vue'
import TransactionEntryDialog from '@/components/transactions/TransactionEntryDialog.vue'

let wrapper: VueWrapper | undefined
let balance: number | null
let missing: boolean
/** Готовит HTTP-границу с полными ответами контрактов. */
beforeEach(() => {
  setActivePinia(createPinia())
  useSessionStore().setUser({ uid: 'test', name: 'Артём', email: 'test@example.com' })
  balance = 100
  missing = false
  vi.spyOn(http, 'get').mockImplementation(
    /** Отвечает на реальные запросы главной страницы. */ async (url, config) => {
      if (url === '/balance-history') {
        if (missing)
          throw { isAxiosError: true, response: { status: 409, data: { code: 'FM-409203' } } }
        return {
          data: {
            date_from: config?.params.date_from,
            date_to: config?.params.date_to,
            currency: 'RUB',
            unit: 'rubles',
            timezone: 'Europe/Moscow',
            points: [{ date: config?.params.date_to, balance }],
          },
        }
      }
      if (url === '/starting-balance') {
        if (missing) throw new Error('Проверка недоступна')
        return { data: { amount: 100, balance_date: '2026-10-25' } }
      }
      if (url === '/transactions') return { data: { content: [], total: 0 } }
      if (url === '/budget-structure')
        return {
          data: {
            year: 2026,
            category_type: 'outcome',
            rows: [],
            total: { money_plan: null, average: null, months: [] },
          },
        }
      throw new Error(`Неожиданный запрос ${url}`)
    },
  )
})
/** Снимает окно и его обработчики после теста. */
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})
/** Проверяет взаимодействие главной страницы с отчётом. */
describe('История остатка на главной', () => {
  /** Событие успешной записи операции обновляет видимый остаток. */
  it('обновляет график после сохранения операции', async () => {
    wrapper = mount(HomeView, { global: { stubs: { TransactionEntryDialog: true } } })
    await flushPromises()
    expect(wrapper.get('output').text()).toBe('100\u00a0₽')
    await wrapper.get('[aria-label="Добавить расход"]').trigger('click')
    balance = -50
    wrapper.getComponent(TransactionEntryDialog).vm.$emit('saved')
    await flushPromises()
    expect(wrapper.get('output').text()).toBe('−50\u00a0₽')
  })
  /** Открывает существующий сценарий даже после сбоя первичной проверки остатка. */
  it('из FM-409203 открывает Первый шаг и загружает график после POST', async () => {
    missing = true
    vi.spyOn(http, 'post').mockImplementation(
      /** Сохраняет стартовый остаток через реальный API-клиент. */ async (url, body) => {
        expect(url).toBe('/starting-balance')
        expect(body).toEqual({ amount: 75 })
        missing = false
        balance = 75
        return { data: { amount: 75, balance_date: '2026-10-25' } }
      },
    )
    wrapper = mount(HomeView, { attachTo: document.body })
    await flushPromises()
    const button = wrapper
      .findAll('button')
      .find(
        /** Находит действие отсутствующего остатка. */ (button) =>
          button.text() === 'Задать стартовый остаток',
      )
    expect(button).toBeDefined()
    await button!.trigger('click')
    await flushPromises()
    const input = document.querySelector<HTMLInputElement>('[role="dialog"] input')!
    expect(input).not.toBeNull()
    input.value = '75'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    document
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flushPromises()
    expect(wrapper.get('output').text()).toBe('75\u00a0₽')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})
