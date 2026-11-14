import { flushPromises, mount, DOMWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api/regularOperations'
import { listCategories } from '@/api/categories'
import * as planApi from '@/api/plannedOperations'
import { plan } from '@/plans/__tests__/fixtures'
import { regularCreationLocation } from '@/regularOperations/navigation'
import type { RegularOperation, RegularOperationList } from '@/types/regularOperation'
import RegularOperationsView from '../RegularOperationsView.vue'

vi.mock('@/api/regularOperations')
vi.mock('@/api/plannedOperations')
vi.mock(
  '@/api/categories',
  /** Даёт форме известную категорию для выбора. */ () => ({
    listCategories: vi
      .fn()
      .mockResolvedValue([{ uid: 'c', name: 'ЖКХ', category_type: 'outcome' }]),
  }),
)

const today = '2026-11-09'
const operation: RegularOperation = {
  uid: 'series',
  money_sum: 35000,
  category: { uid: 'c', name: 'ЖКХ' },
  transaction_type: 'outcome',
  description: 'Квартира',
  frequency: 'monthly',
  first_date: '2025-10-01',
  end_date: '2026-10-01',
  version: 4,
  status: 'ended',
  source_plan_uid: null,
  today,
  timezone: 'Europe/Moscow',
}
const page: RegularOperationList = {
  content: [operation],
  next_skip: null,
  today,
  timezone: 'Europe/Moscow',
  total: 1,
}

/** Запускает вкладку с настоящим маршрутом и модальным окном в body. */
async function show(path: string | ReturnType<typeof regularCreationLocation> = '/regular') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'planned-operations', component: { template: '<div />' } },
      { path: '/regular', name: 'regular-operations', component: RegularOperationsView },
      {
        path: '/regular/:operationUid',
        name: 'regular-operation',
        component: RegularOperationsView,
      },
    ],
  })
  await router.push(path)
  const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

/** Возвращает форму, телепортированную поверх списка. */
function dialog() {
  return new DOMWrapper(document.querySelector('dialog')!)
}

describe('Регулярные операции', /** Проверяет действия вкладки и обе формы входа. */ () => {
  beforeEach(
    /** Восстанавливает независимые ответы API. */ () => {
      Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
        configurable: true,
        value: /** Воспроизводит открытие диалога в jsdom. */ function (this: HTMLDialogElement) {
          this.open = true
        },
      })
      vi.resetAllMocks()
      vi.mocked(listCategories).mockResolvedValue([
        { uid: 'c', name: 'ЖКХ', category_type: 'outcome' } as Awaited<
          ReturnType<typeof listCategories>
        >[number],
      ])
      vi.mocked(api.loadRegularOperations).mockResolvedValue(page)
      vi.mocked(api.readRegularOperation).mockResolvedValue(operation)
      vi.mocked(planApi.loadPlans).mockResolvedValue({ ...page, content: [], due_count: 0 })
    },
  )

  afterEach(
    /** Восстанавливает прототип диалога после теста. */ () => {
      Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    },
  )

  it('показывает завершение и снимает окончание без изменения прошедшей первой даты', /** Проверяет адресный вход и PATCH только изменённых полей. */ async () => {
    const wrapper = await show('/regular/series')
    expect(wrapper.text()).toContain('Завершено')
    expect(dialog().text()).toContain('Операция завершена')
    await dialog().get('input[type=date]').setValue(operation.first_date)
    await dialog().get('button.underline').trigger('click')
    await dialog().get('form').trigger('submit')
    expect(api.updateRegularOperation).toHaveBeenCalledWith('series', {
      expected_version: 4,
      end_date: null,
    })
    wrapper.unmount()
  })

  it('удаляет невыполненные платежи с предупреждением о сохранении выполненных и фактов', /** Проверяет копию подтверждения и версию удаления. */ async () => {
    const wrapper = await show()
    await wrapper.get('li button').trigger('click')
    expect(dialog().text()).toContain('Выполненные планы и фактические операции сохранятся.')
    await dialog().get('form').trigger('submit')
    expect(api.deleteRegularOperation).toHaveBeenCalledWith('series', 4)
    wrapper.unmount()
  })

  it('переносит черновик и отклоняет минус, не повторяя POST после сбоя', /** Проверяет неизменность черновика и единственный запрос создания. */ async () => {
    vi.mocked(api.createRegularOperation).mockRejectedValue(new Error('network'))
    const wrapper = await show(
      regularCreationLocation({
        draft: { date: today, amount: '42', category: 'c', description: 'Черновик' },
      }),
    )
    const amount = dialog().get<HTMLInputElement>('input[inputmode=numeric]')
    expect(amount.element.value).toBe('42')
    await amount.setValue('-8')
    expect(amount.element.value).toBe('42')
    await dialog().get('form').trigger('submit')
    await flushPromises()
    expect(api.createRegularOperation).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ money_sum: 42, description: 'Черновик', first_date: today }),
    )
    expect(api.loadRegularOperations).toHaveBeenCalledTimes(3)
    expect(dialog().text()).toContain('Не удалось создать регулярную операцию')
    wrapper.unmount()
  })

  it('требует выбрать первую дату заново для выполненного плана', /** Не отправляет преобразование с датой источника. */ async () => {
    const source = plan('p', { status: 'completed', planned_date: today })
    const wrapper = await show(regularCreationLocation({ source }))
    expect(dialog().get<HTMLInputElement>('input[type=date]').element.value).toBe('')
    await dialog().get('form').trigger('submit')
    expect(api.convertPlan).not.toHaveBeenCalled()
    await dialog().get('input[type=date]').setValue(today)
    await dialog().get('form').trigger('submit')
    expect(api.convertPlan).toHaveBeenCalledExactlyOnceWith(
      source,
      expect.objectContaining({ first_date: today }),
    )
    wrapper.unmount()
  })

  it('предлагает повторить загрузку и показывает пустое состояние', /** Оставляет создание доступным после успешного повтора. */ async () => {
    vi.mocked(api.loadRegularOperations)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ...page, content: [], total: 0 })
    const wrapper = await show()
    expect(wrapper.text()).toContain('Не удалось загрузить регулярные операции')
    await wrapper.get('section button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Регулярных операций пока нет')
    wrapper.unmount()
  })
})
