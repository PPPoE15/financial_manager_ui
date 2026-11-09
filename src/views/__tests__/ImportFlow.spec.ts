import { beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HomeView from '@/views/HomeView.vue'
import ImportDialog from '@/components/imports/ImportDialog.vue'
import { listTransactions } from '@/api/transactions'
import { getBudgetStructure } from '@/api/budget'
import { getBalanceHistory } from '@/api/balanceHistory'

/** Изолирует сеть, сохраняя настоящие механизмы обновления карточек. */
vi.mock('@/api/transactions', () => ({ listTransactions: vi.fn() }))
/** Изолирует ответ структуры бюджета. */
vi.mock('@/api/budget', () => ({ getBudgetStructure: vi.fn() }))
/** Изолирует ответ финансовых итогов. */
vi.mock('@/api/balanceHistory', () => ({ getBalanceHistory: vi.fn() }))
/** Настраивает независимую сессию и пустые ответы карточек. */
beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(listTransactions).mockResolvedValue([])
  vi.mocked(getBudgetStructure).mockReturnValue(
    new Promise(/** Оставляет загрузку бюджета незавершённой. */ () => {}),
  )
  vi.mocked(getBalanceHistory).mockReturnValue(
    new Promise(/** Оставляет загрузку графика незавершённой. */ () => {}),
  )
})

/** После импорта обновляет оба типа операций, бюджет и финансовые итоги. */
it('открывает импорт из оболочки и обновляет все связанные карточки после saved', async () => {
  const wrapper = mount(HomeView, {
    props: { importRequested: true },
    global: { stubs: { FirstStepDialog: true, ImportDialog: true } },
  })
  await flushPromises()
  const dialog = wrapper.getComponent(ImportDialog)
  vi.mocked(listTransactions).mockClear()
  vi.mocked(getBudgetStructure).mockClear()
  vi.mocked(getBalanceHistory).mockClear()
  dialog.vm.$emit('saved')
  await flushPromises()
  expect(listTransactions).toHaveBeenCalledWith('income')
  expect(listTransactions).toHaveBeenCalledWith('outcome')
  expect(getBudgetStructure).toHaveBeenCalledOnce()
  expect(getBalanceHistory).toHaveBeenCalledOnce()
  dialog.vm.$emit('close')
  await flushPromises()
  expect(wrapper.emitted('importClosed')).toHaveLength(1)
  await wrapper.setProps({ importRequested: false })
  expect(wrapper.findComponent(ImportDialog).exists()).toBe(false)
  wrapper.unmount()
})
