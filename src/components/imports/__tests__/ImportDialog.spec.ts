import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { http } from '@/api/client'
import ImportDialog from '../ImportDialog.vue'

let wrapper: VueWrapper
/** Открывает настоящее телепортируемое окно и изолирует сетевой транспорт. */
beforeEach(() => {
  document.body.innerHTML = '<div id="app"><button id="opener">Импорт CSV</button></div>'
  document.getElementById('opener')!.focus()
  wrapper = mount(ImportDialog, { attachTo: document.body })
})
/** Закрывает окно и очищает заглушки после проверки. */
afterEach(() => {
  wrapper.unmount()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
/** Находит элемент окна после Teleport. */
function element<T extends HTMLElement>(selector: string) {
  const found = document.querySelector<T>(selector)
  if (!found) throw new Error(`Элемент ${selector} отсутствует`)
  return found
}
/** Выбирает файл через настоящий обработчик input. */
async function choose(name = 'operations.csv') {
  const input = element<HTMLInputElement>('input[type=file]')
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['data'], name)] })
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await flushPromises()
}
/** Отправляет форму и дожидается результата. */
async function submit() {
  element('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await flushPromises()
}

/** Показывает результат, запрещает повтор и сообщает родителю об обновлении данных. */
it('сохраняет выбранный файл, показывает число и уведомляет экран', async () => {
  const post = vi
    .spyOn(http, 'post')
    .mockResolvedValue({ data: { transaction_type: 'outcome', imported_count: 2 } })
  await choose()
  expect(element('form').textContent).toContain('operations.csv')
  await submit()
  expect(element('[role=status]').textContent).toContain('2')
  expect(wrapper.emitted('saved')).toHaveLength(1)
  expect(element<HTMLButtonElement>('button[type=submit]').disabled).toBe(true)
  await submit()
  expect(post).toHaveBeenCalledOnce()
})

/** Различает логические записи CSV и строки Excel в сообщениях сервера. */
it.each([
  ['a.csv', 'Запись CSV 4'],
  ['a.xlsx', 'Строка Excel 4'],
])('адресует ошибку %s', async (filename, address) => {
  vi.spyOn(http, 'post').mockRejectedValue({
    response: {
      status: 422,
      data: {
        code: 'FM-422303',
        errors: [
          {
            row: 4,
            field: 'category',
            reason: 'unknown_category',
            message: 'Категория не найдена',
          },
        ],
        errors_truncated: true,
        imported_count: 0,
      },
    },
  })
  await choose(filename)
  await submit()
  expect(element('[role=dialog]').textContent).toContain(address)
  expect(element('[role=dialog]').textContent).toContain('Категория не найдена')
  expect(element('[role=dialog]').textContent).toContain('Показаны первые 100 ошибок')
  expect(wrapper.emitted('saved')).toBeUndefined()
})

/** Ошибка всего файла не получает выдуманный номер строки. */
it('показывает ошибку структуры файла', async () => {
  vi.spyOn(http, 'post').mockRejectedValue({
    response: {
      status: 422,
      data: {
        code: 'FM-422301',
        errors: [
          {
            row: null,
            field: 'file',
            reason: 'invalid_encoding',
            message: 'Нужна кодировка UTF-8',
          },
        ],
        errors_truncated: false,
        imported_count: 0,
      },
    },
  })
  await choose()
  await submit()
  expect(element('[role=dialog]').textContent).toContain('Файл: Нужна кодировка UTF-8')
})

/** Передаёт выбранный пользователем тип в импорт и сбрасывает старый файл. */
it('переключает на доходы и принимает перетаскивание файла', async () => {
  await choose()
  element<HTMLButtonElement>('[data-type=income]').click()
  await flushPromises()
  expect(element<HTMLButtonElement>('button[type=submit]').disabled).toBe(true)
  const event = new Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', {
    value: { files: [new File(['data'], 'income.xlsx')] },
  })
  element('[data-testid=dropzone]').dispatchEvent(event)
  await flushPromises()
  const post = vi
    .spyOn(http, 'post')
    .mockResolvedValue({ data: { transaction_type: 'income', imported_count: 1 } })
  await submit()
  expect(post.mock.calls[0]![0]).toBe('/import-export/imports/income')
  expect(element('[role=dialog]').textContent).toContain('доходов')
})

/** Скачивает правильный формат и освобождает ссылку на Blob. */
it.each(['csv', 'xlsx'])('скачивает шаблон %s', async (format) => {
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn().mockReturnValue('blob:template'),
    revokeObjectURL: vi.fn(),
  })
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(/** Не запускает навигацию jsdom. */ () => {})
  const get = vi.spyOn(http, 'get').mockResolvedValue({ data: new Blob(['template']) })
  element<HTMLButtonElement>(`[data-template=${format}]`).click()
  await flushPromises()
  expect(get).toHaveBeenCalledWith('/import-export/templates/outcome', {
    params: { format },
    responseType: 'blob',
  })
  expect((click.mock.instances[0] as HTMLAnchorElement | undefined)?.download).toBe(
    `outcome-template.${format}`,
  )
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:template')
})

/** Ошибка шаблона не создаёт ложного скачивания и допускает повтор. */
it('показывает сбой скачивания шаблона', async () => {
  vi.spyOn(http, 'get').mockRejectedValue(new Error('Network Error'))
  element<HTMLButtonElement>('[data-template=csv]').click()
  await flushPromises()
  expect(element('[role=dialog]').textContent).toContain('Не удалось скачать шаблон')
  expect(element<HTMLButtonElement>('[data-template=csv]').disabled).toBe(false)
})

/** Удерживает фокус при блокировке формы, запрещает закрытие и повторную отправку. */
it('блокирует окно во время импорта', async () => {
  const post = vi
    .spyOn(http, 'post')
    .mockReturnValue(new Promise(/** Оставляет запрос выполняющимся. */ () => {}))
  await choose()
  await submit()
  expect(element('[role=status]').textContent).toContain('Импорт')
  element('[role=dialog]').dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  )
  await submit()
  expect(post).toHaveBeenCalledOnce()
  expect(wrapper.emitted('close')).toBeUndefined()
  expect(element('input').hasAttribute('disabled')).toBe(true)
  expect(element('[role=dialog]').contains(document.activeElement)).toBe(true)
})

/** Возвращает фокус и снимает inert при закрытии. */
it('закрывается по Escape и восстанавливает фокус', async () => {
  await flushPromises()
  expect(document.getElementById('app')!.hasAttribute('inert')).toBe(true)
  element('[role=dialog]').dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  )
  expect(wrapper.emitted('close')).toHaveLength(1)
  wrapper.unmount()
  expect(document.activeElement?.id).toBe('opener')
  expect(document.getElementById('app')!.hasAttribute('inert')).toBe(false)
})
