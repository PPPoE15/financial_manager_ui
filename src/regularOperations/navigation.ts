import { REGULAR_OPERATIONS_ROUTE } from '@/router/names'
import type { RegularEntry } from './model'

/** Передаёт черновик перехода в памяти, без пользовательских данных в адресе. */
let pending: RegularEntry | undefined

/** Подготавливает открытие формы на вкладке регулярных операций. */
export function regularCreationLocation(entry: RegularEntry) {
  pending = entry
  return { name: REGULAR_OPERATIONS_ROUTE }
}

/** Получает черновик при входе на вкладку и освобождает его. */
export function takeRegularEntry() {
  const entry = pending
  pending = undefined
  return entry
}
