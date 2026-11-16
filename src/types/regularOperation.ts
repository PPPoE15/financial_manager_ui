import type { PlannedOperation } from './plannedOperation'

export type RegularFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RegularOperationItem {
  uid: string
  money_sum: number
  category: PlannedOperation['category']
  transaction_type: PlannedOperation['transaction_type']
  description: string | null
  frequency: RegularFrequency
  first_date: string
  end_date: string | null
  version: number
  status: 'active' | 'ended'
  source_plan_uid: string | null
}

export interface RegularOperation extends RegularOperationItem {
  today: string
  timezone: string
}

export interface RegularOperationList {
  content: RegularOperationItem[]
  total: number
  next_skip: number | null
  today: string
  timezone: string
}

export interface RegularOperationCreate {
  money_sum: number
  category_uid: string
  description: string | null
  frequency: RegularFrequency
  first_date: string
  end_date: string | null
}

export type RegularOperationUpdate = Partial<RegularOperationCreate> & { expected_version: number }
