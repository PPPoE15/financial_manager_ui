import { onScopeDispose, getCurrentScope, ref } from 'vue'
import { fetchTransactions } from '@/api/transactions'
import type { Transaction, TransactionFilters } from '@/types/transaction'

/** Управляет страницами серверного списка, отдельно от черновиков редактора. */
export function useTransactionList() {
  const records = ref<Transaction[]>([])
  const total = ref(0)
  const nextSkip = ref<number | null>(null)
  const filters = ref<TransactionFilters>({
    transaction_type: 'outcome',
    sort: '-transaction_date',
  })
  const loading = ref(false)
  const loadError = ref('')
  const selectedUids = ref(new Set<string>())
  let generation = 0
  let limit = 20
  let controller: AbortController | undefined
  let failedRequest: { skip: number; replace: boolean } | undefined

  /** Отменяет запрос и делает его будущий ответ неактуальным. */
  function invalidate() {
    generation++
    controller?.abort()
    loading.value = false
  }
  /** Запрашивает страницу, исключая параллельные подгрузки и устаревшие ответы. */
  async function request(skip: number, replace: boolean) {
    if (loading.value) return
    const current = generation
    controller = new AbortController()
    loading.value = true
    loadError.value = ''
    failedRequest = undefined
    try {
      const page = await fetchTransactions({ ...filters.value, skip, limit }, controller.signal)
      if (current !== generation) return
      const merged = new Map<string, Transaction>()
      if (!replace) for (const row of records.value) merged.set(row.uid, row)
      for (const row of page.content) merged.set(row.uid, row)
      records.value = [...merged.values()]
      total.value = page.total
      nextSkip.value = page.next_skip
    } catch {
      if (current === generation) {
        failedRequest = { skip, replace }
        loadError.value = 'Не удалось загрузить операции. Повторите загрузку.'
      }
    } finally {
      if (current === generation) loading.value = false
    }
  }
  /** Перечитывает список с начала, не удаляя имеющиеся строки до успешного ответа. */
  async function reload() {
    invalidate()
    await request(0, true)
  }
  /** Повторяет именно неудачную страницу, сохраняя режим замены списка. */
  async function retry() {
    if (failedRequest) await request(failedRequest.skip, failedRequest.replace)
  }
  /** Рассчитывает первую порцию по реальной высоте области списка. */
  async function loadInitial(viewportHeight: number, rowHeight: number) {
    limit = Math.max(
      1,
      Math.min(500, 2 * Math.ceil(Math.max(1, viewportHeight) / Math.max(1, rowHeight))),
    )
    await reload()
  }
  /** Загружает следующую страницу, пока сервер возвращает смещение. */
  async function loadMore() {
    if (nextSkip.value !== null) await request(nextSkip.value, false)
  }
  /** Меняет фильтры и сбрасывает выбор вместе с прежним списком. */
  async function setFilters(value: TransactionFilters) {
    invalidate()
    filters.value = { ...value }
    records.value = []
    total.value = 0
    nextSkip.value = null
    selectedUids.value.clear()
    await request(0, true)
  }
  /** Переключает выбор загруженных строк, не затрагивая будущие страницы. */
  function toggleAllLoaded() {
    const all =
      records.value.length > 0 &&
      records.value.every(
        /** Проверяет текущий выбор строки. */ (row) => selectedUids.value.has(row.uid),
      )
    for (const row of records.value) {
      if (all) selectedUids.value.delete(row.uid)
      else selectedUids.value.add(row.uid)
    }
  }
  if (getCurrentScope()) onScopeDispose(invalidate)
  return {
    records,
    total,
    nextSkip,
    filters,
    loading,
    loadError,
    selectedUids,
    loadInitial,
    loadMore,
    reload,
    retry,
    setFilters,
    toggleAllLoaded,
  }
}
