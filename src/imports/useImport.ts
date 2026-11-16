import { ref } from 'vue'
import {
  importTransactions,
  type ImportFormat,
  type ImportIssue,
  type ImportResult,
} from '@/api/imports'
import { mapImportError } from './errors'
import type { TransactionType } from '@/types/budget'

/** Управляет выбором файла, атомарным импортом и результатами запроса. */
export function useImport() {
  const type = ref<TransactionType>('outcome')
  const file = ref<File | null>(null)
  const format = ref<ImportFormat>('csv')
  const message = ref('')
  const saving = ref(false)
  const result = ref<ImportResult | null>(null)
  const issues = ref<ImportIssue[]>([])
  const truncated = ref(false)

  /** Очищает предыдущий результат при явном новом выборе пользователя. */
  function clearResult() {
    message.value = ''
    result.value = null
    issues.value = []
    truncated.value = false
  }
  /** Проверяет один CSV/XLSX до отправки; содержимое проверяет сервер. */
  function selectFiles(files: File[]) {
    if (saving.value) return
    clearResult()
    file.value = null
    if (!files.length) {
      message.value = 'Выберите файл'
      return
    }
    if (files.length !== 1) {
      message.value = 'Выберите только один файл'
      return
    }
    const selected = files[0]!
    const extension = selected.name.split('.').pop()?.toLowerCase()
    if (extension !== 'csv' && extension !== 'xlsx') {
      message.value = 'Используйте CSV или Excel (.xlsx)'
      return
    }
    if (!selected.size) {
      message.value =
        extension === 'csv' ? 'Строка файла 1 · Файл: файл пуст. Ничего не сохранено.' : 'Файл пуст'
      return
    }
    if (selected.size > 5242880) {
      message.value = 'Файл должен быть не больше 5 МиБ'
      return
    }
    format.value = extension
    file.value = selected
  }
  /** Сбрасывает файл при смене типа, чтобы пользователь подтвердил новый выбор. */
  function changeType(next: TransactionType) {
    if (saving.value || type.value === next) return
    type.value = next
    file.value = null
    clearResult()
  }
  /** Отправляет файл один раз и возвращает признак успешного сохранения. */
  async function submit() {
    if (saving.value || !file.value) return false
    saving.value = true
    clearResult()
    try {
      result.value = await importTransactions(type.value, format.value, file.value)
      file.value = null
      return true
    } catch (error) {
      const mapped = mapImportError(error)
      message.value = mapped.message
      issues.value = mapped.issues
      truncated.value = mapped.truncated
      // После неизвестного исхода необходим осознанный новый выбор файла.
      if (mapped.unknown) file.value = null
      return false
    } finally {
      saving.value = false
    }
  }
  return {
    type,
    file,
    format,
    message,
    saving,
    result,
    issues,
    truncated,
    selectFiles,
    changeType,
    submit,
  }
}
