import { afterEach, expect, it, vi } from 'vitest'
import { http } from '@/api/client'
import { useImport } from '@/imports/useImport'

/** Восстанавливает транспорт после сценария. */
afterEach(() => vi.restoreAllMocks())

/** Проверяет очистку файла при смене смысла операции. */
it('сбрасывает выбранный файл при смене типа', () => {
  const state = useImport()
  state.selectFiles([new File(['data'], 'a.CSV')])
  expect(state.file.value?.name).toBe('a.CSV')
  expect(state.format.value).toBe('csv')
  state.changeType('income')
  expect(state.file.value).toBeNull()
  expect(state.type.value).toBe('income')
})

/** Проверяет клиентские ограничения до HTTP-запроса. */
it.each([
  [[], 'Выберите'],
  [[new File(['data'], 'a.xls')], 'CSV'],
  [[new File([], 'a.csv')], 'пуст'],
  [[new File(['a'], 'a.csv'), new File(['b'], 'b.csv')], 'один'],
  [[new File([new Uint8Array(5242881)], 'a.xlsx')], '5 МиБ'],
])('не отправляет неподходящие файлы: %s', async (files, message) => {
  const post = vi.spyOn(http, 'post')
  const state = useImport()
  state.selectFiles(files as File[])
  expect(state.message.value).toContain(message)
  expect(await state.submit()).toBe(false)
  expect(post).not.toHaveBeenCalled()
})

/** Защищает выбор и отправку, пока сервер обрабатывает файл. */
it('отправляет один запрос и очищает файл после успеха', async () => {
  let finish!: (value: unknown) => void
  const post = vi.spyOn(http, 'post').mockReturnValue(
    new Promise(
      /** Сохраняет завершение запроса. */ (resolve) => {
        finish = resolve
      },
    ),
  )
  const state = useImport()
  state.selectFiles([new File(['data'], 'a.xlsx')])
  const pending = state.submit()
  expect(state.saving.value).toBe(true)
  state.changeType('income')
  state.selectFiles([new File(['new'], 'b.csv')])
  expect(state.type.value).toBe('outcome')
  expect(state.file.value?.name).toBe('a.xlsx')
  expect(await state.submit()).toBe(false)
  expect(post).toHaveBeenCalledOnce()
  finish({ data: { transaction_type: 'outcome', imported_count: 3 } })
  expect(await pending).toBe(true)
  expect(state.result.value?.imported_count).toBe(3)
  expect(state.saving.value).toBe(false)
  expect(state.file.value).toBeNull()
  expect(await state.submit()).toBe(false)
  expect(post).toHaveBeenCalledOnce()
})

/** Сохраняет подробные ошибки сервера для адресного исправления файла. */
it('показывает ошибки строк и признак неполного списка без результата', async () => {
  const issues = [
    { row: 4, field: 'category', reason: 'unknown_category', message: 'Категория не найдена' },
  ]
  vi.spyOn(http, 'post').mockRejectedValue({
    response: {
      status: 422,
      data: { code: 'FM-422303', imported_count: 0, errors: issues, errors_truncated: true },
    },
  })
  const state = useImport()
  state.selectFiles([new File(['data'], 'a.csv')])
  expect(await state.submit()).toBe(false)
  expect(state.issues.value).toEqual(issues)
  expect(state.truncated.value).toBe(true)
  expect(state.message.value).toContain('Ничего не сохранено')
  expect(state.result.value).toBeNull()
})

/** Не утверждает rollback и не повторяет потенциально сохранённые операции. */
it.each([
  new Error('Network Error'),
  { response: { status: 503, data: { code: 'FM-503301', outcome: 'unknown' } } },
  { response: { status: 502, data: '<html>Bad Gateway</html>' } },
])('блокирует повтор после неизвестного исхода', async (error) => {
  const post = vi.spyOn(http, 'post').mockRejectedValue(error)
  const state = useImport()
  state.selectFiles([new File(['data'], 'a.csv')])
  await state.submit()
  expect(state.message.value).toContain('Результат импорта неизвестен')
  expect(state.message.value).toContain('Проверьте список операций')
  expect(state.file.value).toBeNull()
  await state.submit()
  expect(post).toHaveBeenCalledOnce()
})

/** Отличает подтверждённый rollback от неизвестного исхода. */
it('сообщает об отсутствии сохранения при FM-500301', async () => {
  vi.spyOn(http, 'post').mockRejectedValue({
    response: { status: 500, data: { code: 'FM-500301' } },
  })
  const state = useImport()
  state.selectFiles([new File(['data'], 'a.csv')])
  await state.submit()
  expect(state.message.value).toContain('Ничего не сохранено')
  expect(state.file.value).not.toBeNull()
})
