import { expect, it } from 'vitest'
import { mapImportError } from '../errors'

/** Различает структуру, кодировку и значения, сохраняя адресные сообщения сервера. */
it.each([
  ['FM-422301', 'invalid_structure', 'Проверьте структуру файла. Ничего не сохранено.'],
  ['FM-422301', 'invalid_encoding', 'Сохраните файл в кодировке UTF-8. Ничего не сохранено.'],
  ['FM-422303', 'invalid_amount', 'Исправьте ошибки в файле. Ничего не сохранено.'],
  ['FM-422302', 'empty_file', 'В файле нет операций. Ничего не сохранено.'],
])('объясняет %s / %s', (code, reason, message) => {
  const issues = [{ row: 4, field: 'file', reason, message: 'Подробное пояснение сервера' }]
  const mapped = mapImportError({ response: { status: 422, data: { code, errors: issues } } })
  expect(mapped.message).toBe(message)
  expect(mapped.issues).toEqual(issues)
  expect(mapped.unknown).toBe(false)
})

/** При неполном ответе не предлагает менять кодировку без соответствующей ошибки. */
it('сохраняет безопасную подсказку структуры без списка ошибок', () => {
  const mapped = mapImportError({ response: { status: 422, data: { code: 'FM-422301' } } })
  expect(mapped.message).toBe('Проверьте структуру файла. Ничего не сохранено.')
  expect(mapped.issues).toEqual([])
})
