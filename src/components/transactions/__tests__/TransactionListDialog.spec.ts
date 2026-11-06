import { createRouter, createMemoryHistory } from 'vue-router'
import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TransactionListDialog from '../TransactionListDialog.vue'
import { fetchTransactions, saveTransactions, deleteTransactions } from '@/api/transactions'
import { listCategories } from '@/api/categories'
import { transaction } from '@/transactions/__tests__/fixtures'
vi.mock(
  '@/api/transactions',
  /** Подменяет API, оставляя реальные компоненты. */ () => ({
    fetchTransactions: vi.fn(),
    saveTransactions: vi.fn(),
    deleteTransactions: vi.fn(),
    getTransaction: vi.fn(),
  }),
)
vi.mock(
  '@/api/categories',
  /** Возвращает категории выбранного типа. */ () => ({ listCategories: vi.fn() }),
)
let wrapper: ReturnType<typeof mount>
beforeEach(
  /** Готовит страницу и контрактные ответы. */ () => {
    vi.resetAllMocks()
    document.body.innerHTML = '<main id="app"><button id="opener">Открыть</button></main>'
    document.getElementById('opener')!.focus()
    vi.mocked(fetchTransactions).mockResolvedValue({
      content: [transaction()],
      total: 1,
      next_skip: null,
    })
    vi.mocked(listCategories).mockResolvedValue([
      {
        uid: 'food',
        name: 'Продукты',
        category_type: 'outcome',
        money_plan: null,
        description: null,
      },
    ])
  },
)
afterEach(
  /** Удаляет окно и восстанавливает окружение. */ () => {
    wrapper?.unmount()
    document.body.innerHTML = ''
  },
)
/** Находит элемент портала по доступному тексту. */
function button(text: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find(
    /** Ищет видимую кнопку по точной подписи. */ (b) =>
      b.textContent?.trim().replace(/\u00a0/g, ' ') === text,
  )
  if (!found) throw new Error(`Кнопка не найдена: ${text}`)
  return found
}
/** Открывает окно и дожидается первичной загрузки. */
async function open() {
  wrapper = mount(TransactionListDialog, { props: { type: 'outcome' }, attachTo: document.body })
  await flushPromises()
}
/** Меняет значение настоящего поля ввода. */
async function input(label: string, value: string) {
  const el = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}
describe('Окно операций', /** Проверяет пользовательские действия через настоящую разметку. */ () => {
  it('редактирует ячейку и сохраняет без выбора строки', /** Проверяет карандаш и полный набор изменений. */ async () => {
    await open()
    expect(document.body.textContent).toContain('Всего операций: 1')
    expect(document.querySelector('[aria-label="Несохранённые изменения"]')).toBeNull()
    button('2 650 ₽').click()
    await flushPromises()
    await input('Сумма', '200')
    expect(document.querySelector('[aria-label="Несохранённые изменения"]')).not.toBeNull()
    vi.mocked(saveTransactions).mockResolvedValue([
      transaction('one', { money_sum: 200, version: 4 }),
    ])
    button('Сохранить').click()
    await flushPromises()
    expect(saveTransactions).toHaveBeenCalledExactlyOnceWith([
      { uid: 'one', expected_version: 3, changes: { money_sum: 200 } },
    ])
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })
  it('Escape отменяет активную ячейку и не закрывает окно', /** Проверяет возврат значения до начала ввода. */ async () => {
    await open()
    button('2 650 ₽').click()
    await flushPromises()
    await input('Сумма', '200')
    document
      .querySelector('input[aria-label="Сумма"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(document.querySelector('[aria-label="Несохранённые изменения"]')).toBeNull()
    expect(wrapper.emitted('close')).toBeUndefined()
  })
  it('удаляет только после подтверждения, отмена не отправляет запрос', /** Проверяет отдельное подтверждение опасного действия. */ async () => {
    await open()
    const check = document.querySelector<HTMLInputElement>('input[aria-label="Выбрать операцию"]')!
    check.click()
    await flushPromises()
    button('Удалить').click()
    await flushPromises()
    button('Отмена').click()
    await flushPromises()
    expect(deleteTransactions).not.toHaveBeenCalled()
    button('Удалить').click()
    await flushPromises()
    vi.mocked(deleteTransactions).mockResolvedValue([{ index: 0, uid: 'one', status: 204 }])
    button('Удалить 1').click()
    await flushPromises()
    expect(deleteTransactions).toHaveBeenCalledExactlyOnceWith([
      { uid: 'one', expected_version: 3 },
    ])
  })
  it('сохраняет ввод при ошибке и предлагает выбор при закрытии', /** Проверяет защиту несохранённых изменений. */ async () => {
    await open()
    button('2 650 ₽').click()
    await flushPromises()
    await input('Сумма', '200')
    vi.mocked(saveTransactions).mockRejectedValue({ response: { status: 422, data: {} } })
    button('Сохранить').click()
    await flushPromises()
    document.querySelector<HTMLButtonElement>('button[aria-label="Закрыть операции"]')!.click()
    await flushPromises()
    button('Остаться').click()
    await flushPromises()
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(document.body.textContent).toContain('200')
    document.querySelector<HTMLButtonElement>('button[aria-label="Закрыть операции"]')!.click()
    await flushPromises()
    button('Отбросить').click()
    await flushPromises()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
  it('держит фокус внутри окна и возвращает его инициатору', /** Проверяет модальность и клавиатуру. */ async () => {
    await open()
    expect(document.getElementById('app')!.hasAttribute('inert')).toBe(true)
    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>('[data-editor-panel] button:not([disabled])'),
    ]
    const last = buttons[buttons.length - 1]!
    last.focus()
    last.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )
    expect(document.querySelector('[data-editor-panel]')!.contains(document.activeElement)).toBe(
      true,
    )
    wrapper.unmount()
    expect(document.activeElement?.id).toBe('opener')
  })
})

it('массовая дата меняет черновики до сохранения и сохраняет все выбранные строки', /** Проверяет двухэтапное массовое изменение. */ async () => {
  vi.mocked(fetchTransactions).mockResolvedValue({
    content: [transaction(), transaction('two')],
    total: 2,
    next_skip: null,
  })
  await open()
  document
    .querySelector<HTMLInputElement>('input[aria-label="Выбрать загруженные операции"]')!
    .click()
  await flushPromises()
  button('Изменить дату').click()
  await flushPromises()
  const date = document.querySelector<HTMLInputElement>('[data-editor-dialog] input[type="date"]')!
  date.value = '2026-10-01'
  date.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
  button('Применить к 2').click()
  await flushPromises()
  expect(saveTransactions).not.toHaveBeenCalled()
  vi.mocked(saveTransactions).mockResolvedValue([
    transaction('one', { transaction_date: '2026-10-01T14:30:12.123456', version: 4 }),
    transaction('two', { transaction_date: '2026-10-01T14:30:12.123456', version: 4 }),
  ])
  button('Сохранить').click()
  await flushPromises()
  expect(saveTransactions).toHaveBeenCalledExactlyOnceWith([
    { uid: 'one', expected_version: 3, changes: { date: '2026-10-01' } },
    { uid: 'two', expected_version: 3, changes: { date: '2026-10-01' } },
  ])
})
it('не теряет черновик при отмене переключения типа', /** Проверяет защиту фильтра и выбранный тип после отмены. */ async () => {
  await open()
  button('2 650 ₽').click()
  await flushPromises()
  await input('Сумма', '200')
  button('Доходы').click()
  await flushPromises()
  button('Остаться').click()
  await flushPromises()
  expect(button('Расходы').getAttribute('aria-pressed')).toBe('true')
  expect(fetchTransactions).toHaveBeenCalledTimes(1)
  expect(document.querySelector('[aria-label="Несохранённые изменения"]')).not.toBeNull()
})
it('удерживает Tab в подтверждении удаления', /** Проверяет фокус именно вложенного окна. */ async () => {
  await open()
  document.querySelector<HTMLInputElement>('input[aria-label="Выбрать операцию"]')!.click()
  await flushPromises()
  button('Удалить').click()
  await flushPromises()
  const last = button('Удалить 1')
  last.focus()
  last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
  expect(document.activeElement).toBe(button('Отмена'))
  button('Отмена').dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
  )
  expect(document.activeElement).toBe(last)
})

it('автоматически догружает страницу и отключает наблюдатели при закрытии', /** Проверяет связь IntersectionObserver с API и очистку ресурсов. */ async () => {
  let intersection!: IntersectionObserverCallback
  const disconnect = vi.fn()
  class Observer {
    /** Запоминает браузерный callback для имитации прокрутки. */
    constructor(callback: IntersectionObserverCallback) { intersection = callback }
    /** Имитирует регистрацию конца списка. */
    observe() {}
    /** Имитирует снятие наблюдения. */
    unobserve() {}
    /** Записывает освобождение наблюдателя. */
    disconnect() { disconnect() }
  }
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.mocked(fetchTransactions).mockResolvedValueOnce({ content: [transaction()], total: 2, next_skip: 1 }).mockResolvedValueOnce({ content: [transaction('two')], total: 2, next_skip: null })
  await open()
  intersection([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
  await flushPromises()
  expect(fetchTransactions).toHaveBeenCalledTimes(2)
  expect(document.querySelectorAll('[data-uid]')).toHaveLength(2)
  wrapper.unmount(); expect(disconnect).toHaveBeenCalledTimes(1)
  vi.unstubAllGlobals()
})
it('при уходе на другой маршрут ожидает решение о правках', /** Проверяет настоящее разрешение и отмену навигации роутера. */ async () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }, { path: '/other', component: { template: '<div />' } }] })
  await router.push('/'); await router.isReady()
  wrapper = mount(TransactionListDialog, { props: { type: 'outcome' }, global: { plugins: [router] }, attachTo: document.body }); await flushPromises()
  button('2 650 ₽').click(); await flushPromises(); await input('Сумма', '200')
  const navigation = router.push('/other'); await flushPromises()
  button('Остаться').click(); await navigation; expect(router.currentRoute.value.path).toBe('/')
  const next = router.push('/other'); await flushPromises()
  button('Отбросить').click(); await next; expect(router.currentRoute.value.path).toBe('/other')
})
it('после сохранения возвращает фокус на доступный контрол окна', /** Проверяет фокус после отключения кнопки сохранения. */ async () => {
  await open(); button('2 650 ₽').click(); await flushPromises(); await input('Сумма', '200')
  vi.mocked(saveTransactions).mockResolvedValue([transaction('one', { money_sum: 200, version: 4 })])
  button('Сохранить').focus(); button('Сохранить').click(); await flushPromises()
  expect(document.querySelector('[data-editor-panel]')!.contains(document.activeElement)).toBe(true)
  expect((document.activeElement as HTMLButtonElement).disabled).toBe(false)
})
