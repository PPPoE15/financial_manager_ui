import type { Router } from 'vue-router'
import { REGULAR_OPERATIONS_ROUTE } from '@/router/names'
import type { RegularEntry } from './model'

let pending: { key: number; entry: RegularEntry } | undefined
let sequence = 0

/** Открывает вкладку с черновиком, привязанным только к этому переходу. */
export async function openRegularCreation(router: Router, entry: RegularEntry) {
  const key = ++sequence
  pending = { key, entry }
  try {
    const failure = await router.push({
      name: REGULAR_OPERATIONS_ROUTE,
      state: { regularEntryKey: key },
    })
    if (!failure && router.currentRoute.value.name === REGULAR_OPERATIONS_ROUTE) return
    return failure
  } finally {
    if (pending?.key === key && router.options.history.state.regularEntryKey !== key)
      pending = undefined
  }
}

/** Забирает черновик только для связанной записи истории. */
export function takeRegularEntry(router: Router) {
  if (!pending || pending.key !== router.options.history.state.regularEntryKey) return
  const entry = pending.entry
  pending = undefined
  return entry
}
