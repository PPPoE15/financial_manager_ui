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
