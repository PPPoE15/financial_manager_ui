import type { TransactionType } from './budget'
import type { Transaction } from './transaction'
export interface PlannedOperation {
  uid: string
  planned_date: string
  money_sum: number
  category: { uid: string; name: string }
  transaction_type: TransactionType
  description: string | null
  version: number
  status: 'pending' | 'completed'
  completed_at: string | null
  transaction_uid: string | null
  transaction_state: 'none' | 'available' | 'deleted'
  recurrence?: {
    operation_uid: string
    scheduled_date: string
    operation_status: 'active' | 'ended' | 'deleted'
    is_exception: boolean
  } | null
  today: string
  timezone: string
}
export interface PlannedOperationList {
  content: PlannedOperation[]
  total: number
  due_count: number
  next_skip: number | null
  today: string
  timezone: string
}
export interface PlanFilters {
  transaction_type?: TransactionType
  include_completed: boolean
  include_regular?: boolean
}
export interface PlanCreate {
  planned_date: string
  money_sum: number
  category_uid: string
  description: string | null
}
export type PlanUpdate = Partial<PlanCreate> & { expected_version: number }
export interface PlanConfirmation {
  expected_version: number
  transaction_date: string
  money_sum: number
  category_uid: string
  description: string | null
}
export interface PlanConfirmed {
  plan: PlannedOperation
  transaction: Transaction
}
