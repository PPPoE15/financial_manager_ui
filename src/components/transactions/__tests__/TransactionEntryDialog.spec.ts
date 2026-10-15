import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { listCategories } from '@/api/categories'
import { createTransaction } from '@/api/transactions'
import TransactionEntryDialog from '../TransactionEntryDialog.vue'

vi.mock('@/api/categories', () => ({ listCategories: vi.fn() }))
vi.mock('@/api/transactions', () => ({ createTransaction: vi.fn() }))
let wrapper: VueWrapper
const dialog = () => new DOMWrapper(document.querySelector('[role="dialog"]')!)
const rows = () => dialog().findAll('[data-testid="transaction-row"]')
async function open(type: 'income' | 'outcome' = 'outcome') {
  wrapper = mount(TransactionEntryDialog, { props: { type }, attachTo: document.body })
  await flushPromises()
}
async function fill(index = 0, amount = '4990') {
  const row = rows()[index]!
  await row.get('select').setValue('food')
  await row.get('input[inputmode="numeric"]').setValue(amount)
}
async function save() {
  await dialog().get('form').trigger('submit')
  await flushPromises()
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 15, 9, 8, 7))
  vi.mocked(listCategories).mockResolvedValue([
    {
      uid: 'food',
      name: 'Продукты',
      category_type: 'outcome',
      money_plan: null,
      description: null,
    },
  ])
  vi.mocked(createTransaction).mockResolvedValue({
    uid: 't',
    transaction_date: '2026-10-15T09:08:07',
    category: { uid: 'food', name: 'Продукты' },
    money_sum: 4990,
    transaction_type: 'outcome',
    description: null,
  })
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('Ввод транзакций', () => {
  it('позволяет отменить начатую строку, очистив категорию, и сохранить остальные', async () => {
    await open()
    await fill()
    await fill(1, '123')
    const cancelled = rows()[1]!
    expect(cancelled.get('option[value=""]').attributes('disabled')).toBeUndefined()
    await cancelled.get('select').setValue('')
    await cancelled.get('input[inputmode="numeric"]').setValue('')
    await save()
    expect(createTransaction).toHaveBeenCalledTimes(1)
    expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ money_sum: 4990 }))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
  it.each(['income', 'outcome'] as const)(
    'загружает категории %s, ставит сегодня и сохраняет выбранную дату с местным временем',
    async (type) => {
      await open(type)
      expect(listCategories).toHaveBeenCalledWith(type)
      expect(dialog().text()).toContain(
        type === 'income' ? 'Учесть новые доходы' : 'Учесть новые расходы',
      )
      expect(dialog().get<HTMLInputElement>('input[type="date"]').element.value).toBe('2026-10-15')
      await dialog().get('input[type="date"]').setValue('2026-02-03')
      await fill()
      expect(rows()).toHaveLength(2)
      await rows()[0]!.get('input[aria-label="Комментарий"]').setValue('Покупки')
      await save()
      expect(createTransaction).toHaveBeenCalledExactlyOnceWith({
        category_uid: 'food',
        money_sum: 4990,
        description: 'Покупки',
        transaction_type: type,
        transaction_date: '2026-02-03T09:08:07',
      })
      expect(wrapper.emitted('saved')).toHaveLength(1)
      expect(wrapper.emitted('close')).toHaveLength(1)
    },
  )
  it.each(['0', '-1', '1.5', '1e3', '1000000001', 'abc'])(
    'отклоняет сумму %s до запроса',
    async (amount) => {
      await open()
      await fill(0, amount)
      await save()
      expect(createTransaction).not.toHaveBeenCalled()
      expect(rows()[0]!.get('input[inputmode="numeric"]').attributes('aria-invalid')).toBe('true')
    },
  )
  it.each(['1', '1000000000'])('принимает границу суммы %s', async (amount) => {
    await open()
    await fill(0, amount)
    await save()
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ money_sum: Number(amount) }),
    )
  })
  it('требует категорию и сумму для строки с комментарием, игнорирует пустую строку', async () => {
    await open()
    await rows()[0]!.get('input[aria-label="Комментарий"]').setValue('Заметка')
    expect(rows()).toHaveLength(2)
    await save()
    expect(createTransaction).not.toHaveBeenCalled()
    expect(rows()[0]!.findAll('[aria-invalid="true"]')).toHaveLength(2)
    expect(rows()[1]!.findAll('[aria-invalid="true"]')).toHaveLength(0)
  })
  it('проверяет длину комментария и обязательную дату', async () => {
    await open()
    await fill()
    await rows()[0]!.get('input[aria-label="Комментарий"]').setValue('я'.repeat(501))
    await dialog().get('input[type="date"]').setValue('')
    await save()
    expect(createTransaction).not.toHaveBeenCalled()
    expect(dialog().get('input[type="date"]').attributes('aria-invalid')).toBe('true')
    expect(rows()[0]!.get('input[aria-label="Комментарий"]').attributes('aria-invalid')).toBe(
      'true',
    )
  })
  it('удаляет сохранённые строки при частичной ошибке и повторяет только несохранённые', async () => {
    vi.mocked(createTransaction)
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce({ isAxiosError: true, response: { data: { code: 'FM-409202' } } })
      .mockResolvedValueOnce({} as never)
    await open()
    await fill()
    await fill(1, '100')
    await save()
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(rows()).toHaveLength(2)
    expect(rows()[0]!.text()).toContain('лимит')
    expect(rows()[0]!.get<HTMLInputElement>('input[inputmode="numeric"]').element.value).toBe('100')
    await save()
    expect(createTransaction).toHaveBeenCalledTimes(3)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
  it.each([
    ['FM-400202', 'Тип операции не совпадает'],
    ['FM-400201', 'Статья не найдена'],
    ['FM-409202', 'лимит'],
    ['UNKNOWN', 'Не удалось сохранить'],
  ])('показывает ошибку %s у строки', async (code, message) => {
    vi.mocked(createTransaction).mockRejectedValue({
      isAxiosError: true,
      response: { data: { code } },
    })
    await open()
    await fill()
    await save()
    expect(rows()[0]!.text()).toContain(message)
    expect(wrapper.emitted('saved')).toBeUndefined()
  })
  it('показывает пустое состояние с переходом к редактору', async () => {
    vi.mocked(listCategories).mockResolvedValue([])
    await open()
    expect(dialog().text()).toContain('Статей расходов пока нет')
    await dialog()
      .findAll('button')
      .find((b) => b.text() === 'Редактировать категории')!
      .trigger('click')
    expect(wrapper.emitted('editCategories')).toHaveLength(1)
    expect(createTransaction).not.toHaveBeenCalled()
  })
  it('повторяет неудачную загрузку категорий', async () => {
    vi.mocked(listCategories).mockRejectedValueOnce(new Error('offline'))
    await open()
    expect(dialog().text()).toContain('Не удалось загрузить статьи')
    await dialog()
      .findAll('button')
      .find((b) => b.text() === 'Повторить')!
      .trigger('click')
    await flushPromises()
    expect(rows()).toHaveLength(1)
  })
  it('не отправляет повторный submit во время сохранения', async () => {
    vi.mocked(createTransaction).mockReturnValue(new Promise(() => {}))
    await open()
    await fill()
    await save()
    await save()
    expect(createTransaction).toHaveBeenCalledTimes(1)
  })
  it('закрывается по Esc и крестику, удерживает Tab и восстанавливает фокус', async () => {
    const app = document.createElement('div')
    app.id = 'app'
    const opener = document.createElement('button')
    app.append(opener)
    document.body.append(app)
    opener.focus()
    await open()
    expect(app.hasAttribute('inert')).toBe(true)
    const close = dialog().get<HTMLButtonElement>('[aria-label="Закрыть"]')
    close.element.focus()
    await close.trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(dialog().get('button[type="submit"]').element)
    await dialog().get('button[type="submit"]').trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(close.element)
    await close.trigger('keydown', { key: 'Escape' })
    await close.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)
    wrapper.unmount()
    expect(app.hasAttribute('inert')).toBe(false)
    expect(document.activeElement).toBe(opener)
  })
})
