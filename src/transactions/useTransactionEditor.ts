import { computed, ref } from 'vue'
import { deleteTransactions, getTransaction, saveTransactions } from '@/api/transactions'
import type { Transaction, TransactionVersionItem } from '@/types/transaction'
import {
  buildChanges,
  createDraft,
  validateDraft,
  type EditorField,
  type TransactionDraft,
} from './editorModel'
import { errorField, readEditorError } from './editorErrors'

/** Хранит черновики отдельно от списка и защищает пакетные изменения версиями. */
export function useTransactionEditor(options: {
  refresh: () => Promise<unknown>
  onChanged: () => void
}) {
  const draftsByUid = ref(new Map<string, TransactionDraft>())
  const busy = ref(false)
  const message = ref('')
  const unresolved = ref(new Set<string>())
  const currentByUid = ref(new Map<string, Transaction | null>())
  const dirty = computed(
    /** Находит реальные отличия от сохранённой базы. */ () =>
      [...draftsByUid.value.values()].filter(
        /** Проверяет наличие изменённых полей. */ (row) =>
          Object.keys(buildChanges(row)).length > 0,
      ),
  )
  const removedUids = ref(new Set<string>())

  /** Принимает чтение сервера, не затирая черновики или ошибки строк. */
  function ingest(records: Transaction[]) {
    for (const record of records) {
      if (removedUids.value.has(record.uid)) continue
      const existing = draftsByUid.value.get(record.uid)
      if (
        !existing ||
        (!Object.keys(buildChanges(existing)).length &&
          !Object.keys(existing.errors).length &&
          !unresolved.value.has(record.uid))
      )
        draftsByUid.value.set(record.uid, createDraft(record))
    }
  }
  /** Меняет только локальное значение ячейки. */
  function edit(uid: string, field: EditorField, value: string) {
    if (busy.value) return
    const draft = draftsByUid.value.get(uid)
    if (!draft) return
    draft.values[field] = value
    delete draft.errors[field]
  }
  /** Применяет календарную дату к выбранным черновикам. */
  function applyDate(uids: string[], date: string) {
    if (uids.length <= 100) for (const uid of uids) edit(uid, 'date', date)
  }
  /** Применяет выбранную категорию к выбранным черновикам. */
  function applyCategory(uids: string[], categoryUid: string) {
    if (uids.length <= 100) for (const uid of uids) edit(uid, 'category_uid', categoryUid)
  }
  /** Отбрасывает правки явно выбранной строки или всех строк. */
  function discard(uid?: string) {
    if (busy.value) return
    for (const key of uid ? [uid] : [...draftsByUid.value.keys()]) {
      const draft = draftsByUid.value.get(key)
      if (draft) draftsByUid.value.set(key, createDraft(draft.original))
      unresolved.value.delete(key)
      currentByUid.value.delete(key)
    }
    message.value = ''
  }
  /** Перечитывает список и отчёты отдельно от результата записи. */
  async function refresh() {
    options.onChanged()
    try {
      await options.refresh()
    } catch {
      message.value = 'Изменения обработаны, но список не удалось обновить. Повторите загрузку.'
    }
  }
  /** Не позволяет отправить невалидный или неподтверждённый пакет. */
  function allowed(items: TransactionVersionItem[]) {
    if (!items.length || items.length > 100) {
      message.value = 'За один раз можно обработать от 1 до 100 операций.'
      return false
    }
    if (
      items.some(
        /** Проверяет обязательность сверки перед повтором. */ (item) =>
          unresolved.value.has(item.uid),
      )
    ) {
      message.value = 'Сначала сверьте операции с актуальными данными.'
      return false
    }
    return true
  }
  /** Сохраняет ошибки строк и помечает неизвестные результаты для обязательной сверки. */
  async function failed(error: unknown, items: TransactionVersionItem[]) {
    const problem = readEditorError(error)
    message.value = problem.message
    for (const detail of problem.errors) {
      const item = items[detail.index ?? -1]
      if (!item || (detail.uid && detail.uid !== item.uid)) continue
      const draft = draftsByUid.value.get(item.uid)
      if (draft) draft.errors[errorField(detail.field)] = detail.message || problem.message
    }
    if ([404, 409].includes(problem.status) || problem.status === 0 || problem.status >= 500) {
      for (const item of items) unresolved.value.add(item.uid)
      await refresh()
    }
  }
  /** Отправляет все изменённые строки одним атомарным запросом. */
  async function save(): Promise<boolean> {
    if (busy.value) return false
    message.value = ''
    if (!dirty.value.length) return true
    const drafts = [...dirty.value]
    const items = drafts.map(
      /** Формирует минимальный PATCH с исходной версией. */ (draft) => ({
        uid: draft.original.uid,
        expected_version: draft.original.version,
        changes: buildChanges(draft),
      }),
    )
    if (!allowed(items)) return false
    for (const draft of drafts) draft.errors = validateDraft(draft)
    if (
      drafts.some(
        /** Проверяет ошибки полей до обращения к API. */ (draft) =>
          Object.keys(draft.errors).length,
      )
    ) {
      message.value = 'Проверьте поля операций.'
      return false
    }
    if (new TextEncoder().encode(JSON.stringify({ items })).byteLength > 524288) {
      message.value = 'Запрос слишком большой. Уменьшите число изменений.'
      return false
    }
    busy.value = true
    try {
      const result = await saveTransactions(items)
      if (
        !Array.isArray(result) ||
        result.length !== items.length ||
        result.some(
          /** Проверяет соответствие подтверждения отправленному пакету. */ (row, index) =>
            row.uid !== items[index]?.uid || row.version !== items[index]!.expected_version + 1,
        )
      )
        throw new Error('Некорректный ответ сохранения')
      for (const row of result) draftsByUid.value.set(row.uid, createDraft(row))
      await refresh()
      return true
    } catch (error) {
      await failed(error, items)
      return false
    } finally {
      busy.value = false
    }
  }
  /** Удаляет выбранные записи и разбирает частичные результаты по каждой строке. */
  async function remove(uids: string[]) {
    if (busy.value) return
    message.value = ''
    const items = [...new Set(uids)].flatMap(
      /** Берёт версию сохранённой базы выбранной строки. */ (uid) => {
        const draft = draftsByUid.value.get(uid)
        return draft ? [{ uid, expected_version: draft.original.version }] : []
      },
    )
    if (!allowed(items)) return
    busy.value = true
    try {
      const results = await deleteTransactions(items)
      if (
        !Array.isArray(results) ||
        results.length !== items.length ||
        results.some(
          /** Отвергает неполные или перепутанные подтверждения. */ (result, index) =>
            result.index !== index ||
            result.uid !== items[index]?.uid ||
            ![204, 404, 409].includes(result.status),
        )
      )
        throw new Error('Некорректный ответ удаления')
      let failures = 0
      for (const result of results) {
        if (result.status === 204) {
          draftsByUid.value.delete(result.uid)
          removedUids.value.add(result.uid)
          unresolved.value.delete(result.uid)
        } else {
          failures++
          const draft = draftsByUid.value.get(result.uid)
          if (draft) draft.errors.row = result.message
          unresolved.value.add(result.uid)
        }
      }
      message.value = failures
        ? `Не удалено операций: ${failures}. Сверьте данные перед повтором.`
        : ''
      await refresh()
    } catch (error) {
      await failed(error, items)
    } finally {
      busy.value = false
    }
  }
  /** Читает конкретный UID, не делая выводов о его наличии по странице списка. */
  async function reconcile(uid: string) {
    if (busy.value) return
    busy.value = true
    currentByUid.value.delete(uid)
    try {
      currentByUid.value.set(uid, await getTransaction(uid))
    } catch (error) {
      if (readEditorError(error).status === 404) currentByUid.value.set(uid, null)
      else message.value = 'Не удалось сверить операцию. Повторите загрузку.'
    } finally {
      busy.value = false
    }
  }
  /** Принимает актуальные серверные значения после явного выбора пользователя. */
  function acceptServer(uid: string) {
    if (busy.value || !currentByUid.value.has(uid)) return
    const current = currentByUid.value.get(uid)
    if (current) draftsByUid.value.set(uid, createDraft(current))
    else {
      draftsByUid.value.delete(uid)
      removedUids.value.add(uid)
    }
    unresolved.value.delete(uid)
    currentByUid.value.delete(uid)
  }
  /** Переносит только изменённые поля на явно подтверждённую новую версию. */
  function reapplyDraft(uid: string) {
    if (busy.value) return
    const current = currentByUid.value.get(uid),
      old = draftsByUid.value.get(uid)
    if (!current || !old) return
    const changes = buildChanges(old),
      next = createDraft(current)
    if ('date' in changes) next.values.date = old.values.date
    if ('money_sum' in changes) next.values.amount = old.values.amount
    if ('category_uid' in changes) next.values.category_uid = old.values.category_uid
    if ('description' in changes) next.values.description = old.values.description
    draftsByUid.value.set(uid, next)
    unresolved.value.delete(uid)
    currentByUid.value.delete(uid)
  }
  return {
    draftsByUid,
    dirty,
    busy,
    message,
    unresolved,
    currentByUid,
    removedUids,
    ingest,
    edit,
    applyDate,
    applyCategory,
    discard,
    save,
    remove,
    reconcile,
    acceptServer,
    reapplyDraft,
  }
}
