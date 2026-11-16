/** Стартовый остаток: сумма в целых рублях на конец дня `balance_date` (см. `contracts/transaction.openapi.yaml`). */
export interface StartingBalance {
  amount: number
  balance_date: string
}

/** Тело `POST /transaction/starting-balance`; без `balance_date` сервер подставляет вчерашний день. */
export interface StartingBalanceCreate {
  amount: number
}
