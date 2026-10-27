import { afterEach, expect, it, vi } from 'vitest'
import { http } from '@/api/client'
import { downloadImportTemplate, importTransactions } from '@/api/imports'

/** Восстанавливает HTTP-клиент после каждого сценария. */
afterEach(() => vi.restoreAllMocks())

/** Проверяет маршруты и содержимое multipart для каждого варианта импорта. */
it.each([
  ['income', 'csv'],
  ['income', 'xlsx'],
  ['outcome', 'csv'],
  ['outcome', 'xlsx'],
] as const)('импортирует %s из %s единственным файлом', async (type, format) => {
  const file = new File(['data'], `operations.${format}`)
  const post = vi
    .spyOn(http, 'post')
    .mockResolvedValue({ data: { transaction_type: type, imported_count: 2 } })
  expect(await importTransactions(type, format, file)).toEqual({
    transaction_type: type,
    imported_count: 2,
  })
  expect(post).toHaveBeenCalledOnce()
  const [url, body, config] = post.mock.calls[0]!
  expect(url).toBe(`/import-export/imports/${type}`)
  expect(config).toEqual({ params: { format } })
  expect(body).toBeInstanceOf(FormData)
  expect([...(body as FormData).entries()]).toEqual([['file', file]])
})

/** Проверяет бинарный ответ и параметры скачивания соответствующего шаблона. */
it.each([
  ['income', 'csv'],
  ['income', 'xlsx'],
  ['outcome', 'csv'],
  ['outcome', 'xlsx'],
] as const)('скачивает шаблон %s/%s', async (type, format) => {
  const blob = new Blob(['template'])
  const get = vi.spyOn(http, 'get').mockResolvedValue({ data: blob })
  expect(await downloadImportTemplate(type, format)).toBe(blob)
  expect(get).toHaveBeenCalledWith(`/import-export/templates/${type}`, {
    params: { format },
    responseType: 'blob',
  })
})

/** Не повторяет потенциально сохранённый импорт после потери ответа. */
it('передаёт сетевой сбой без повтора', async () => {
  const error = new Error('Network Error')
  const post = vi.spyOn(http, 'post').mockRejectedValue(error)
  await expect(importTransactions('outcome', 'csv', new File(['data'], 'a.csv'))).rejects.toBe(
    error,
  )
  expect(post).toHaveBeenCalledOnce()
})
