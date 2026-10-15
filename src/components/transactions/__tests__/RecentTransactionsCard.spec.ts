import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { listTransactions } from '@/api/transactions'
import RecentTransactionsCard from '@/components/transactions/RecentTransactionsCard.vue'
import type { Transaction } from '@/types/transaction'

vi.mock('@/api/transactions', () => ({ listTransactions: vi.fn() }))
const api = vi.mocked(listTransactions)
function record(uid = 'new', date = '2026-10-15T00:01:00.123456'): Transaction {
  return {
    uid,
    transaction_date: date,
    category: { uid: 'category', name: 'Зарплата' },
    money_sum: 12345,
    transaction_type: 'income',
    description: 'Длинный комментарий '.repeat(20),
  }
}
function deferred() {
  let resolve!: (value: Transaction[]) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<Transaction[]>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

beforeEach(() => api.mockReset())
describe('Недавние транзакции', () => {
  it.each([
    ['income', 'Доходы'],
    ['outcome', 'Расходы'],
  ] as const)('загружает %s и показывает пустое состояние', async (type, title) => {
    api.mockResolvedValue([])
    const wrapper = mount(RecentTransactionsCard, { props: { type } })
    await flushPromises()
    expect(api).toHaveBeenCalledWith(type)
    expect(wrapper.get('h2').text()).toBe(title)
    expect(wrapper.text()).toContain('Недавно добавленные записи')
    expect(wrapper.text()).toContain(type === 'income' ? 'Доходов пока нет' : 'Расходов пока нет')
  })
  it('показывает загрузку до ответа', async () => {
    const pending = deferred()
    api.mockReturnValue(pending.promise)
    const wrapper = mount(RecentTransactionsCard, { props: { type: 'income' } })
    expect(wrapper.get('[role="status"]').text()).toContain('Загрузка')
    expect(wrapper.text()).not.toContain('Доходов пока нет')
    pending.resolve([])
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).not.toContain('Загрузка')
  })
  it('сохраняет серверный порядок, форматирует локальную дату и рубли, раскрывает обрезанный текст', async () => {
    const latest = record()
    api.mockResolvedValue([latest, { ...record('old', '2026-10-14T23:59:00'), description: null }])
    const wrapper = mount(RecentTransactionsCard, { props: { type: 'income' } })
    await flushPromises()
    const rows = wrapper.findAll('li')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('15.10.2026')
    expect(rows[1]!.text()).toContain('14.10.2026')
    expect(rows[0]!.text()).toContain('12\u00a0345\u00a0₽')
    expect(rows[0]!.text()).toContain('Зарплата')
    expect(rows[0]!.get('time').attributes('datetime')).toBe(latest.transaction_date)
    expect(rows[0]!.get('[data-testid="description"]').attributes('title')).toBe(latest.description)
    expect(rows[1]!.find('[data-testid="description"]').exists()).toBe(false)
  })
  it('показывает ошибку и повторяет запрос кнопкой', async () => {
    api.mockRejectedValueOnce(new Error('сеть')).mockResolvedValueOnce([record()])
    const wrapper = mount(RecentTransactionsCard, { props: { type: 'income' } })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('Не удалось загрузить доходы')
    const retry = wrapper.findAll('button').find((button) => button.text() === 'Повторить')!
    await retry.trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.findAll('li')).toHaveLength(1)
  })
  it('обновляется внешним reload после сохранения', async () => {
    api.mockResolvedValueOnce([]).mockResolvedValueOnce([record()])
    const wrapper = mount(RecentTransactionsCard, { props: { type: 'income' } })
    await flushPromises()
    await wrapper.vm.reload()
    await flushPromises()
    expect(api).toHaveBeenCalledTimes(2)
    expect(wrapper.findAll('li')).toHaveLength(1)
  })
  it.each(['ответ', 'ошибка'])(
    'устаревший %s не перезаписывает результат обновления',
    async (kind) => {
      const old = deferred()
      api.mockReturnValueOnce(old.promise).mockResolvedValueOnce([record()])
      const wrapper = mount(RecentTransactionsCard, { props: { type: 'income' } })
      await wrapper.vm.reload()
      if (kind === 'ответ') old.resolve([])
      else old.reject(new Error('устаревшая ошибка'))
      await flushPromises()
      expect(wrapper.findAll('li')).toHaveLength(1)
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    },
  )
  it('перезагружает данные при смене типа', async () => {
    api.mockResolvedValue([])
    const wrapper = mount(RecentTransactionsCard, { props: { type: 'income' } })
    await flushPromises()
    await wrapper.setProps({ type: 'outcome' })
    await flushPromises()
    expect(api).toHaveBeenLastCalledWith('outcome')
    expect(wrapper.text()).toContain('Расходов пока нет')
  })
  it('плюс сообщает тип записи родителю для будущего окна ввода', async () => {
    api.mockResolvedValue([])
    const wrapper = mount(RecentTransactionsCard, { props: { type: 'outcome' } })
    await wrapper.get('button[aria-label="Добавить расход"]').trigger('click')
    expect(wrapper.emitted('add')).toEqual([['outcome']])
  })
})
