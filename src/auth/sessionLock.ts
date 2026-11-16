/** Общая блокировка refresh/logout для всех вкладок одного origin. */
export async function withSessionLock(
  action: () => Promise<void>,
  allowWithoutLock = false,
): Promise<void> {
  if (!navigator.locks) {
    if (allowWithoutLock) return action()
    // Без межвкладочной блокировки нельзя безопасно расходовать одноразовый refresh.
    throw new Error('Для продления сессии необходим Web Locks API (HTTPS или localhost)')
  }
  await navigator.locks.request('fm-session', action)
}
