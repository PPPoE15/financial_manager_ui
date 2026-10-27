import { http } from '@/api/client'
import type { TransactionType } from '@/types/budget'

export type ImportFormat = 'csv' | 'xlsx'
export interface ImportResult {
  transaction_type: TransactionType
  imported_count: number
}
export interface ImportIssue {
  row: number | null
  field: 'file' | 'date' | 'amount' | 'category' | 'description'
  reason: string
  message: string
}

/** Загружает бинарный шаблон выбранного типа операций и формата. */
export async function downloadImportTemplate(
  type: TransactionType,
  format: ImportFormat,
): Promise<Blob> {
  const { data } = await http.get<Blob>(`/import-export/templates/${type}`, {
    params: { format },
    responseType: 'blob',
  })
  return data
}

/** Отправляет один файл без автоматического повтора при неизвестном исходе. */
export async function importTransactions(
  type: TransactionType,
  format: ImportFormat,
  file: File,
): Promise<ImportResult> {
  const body = new FormData()
  body.append('file', file)
  const { data } = await http.post<ImportResult>(`/import-export/imports/${type}`, body, {
    params: { format },
  })
  return data
}
