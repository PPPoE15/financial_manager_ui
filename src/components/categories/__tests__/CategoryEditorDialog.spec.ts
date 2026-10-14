import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'

import { createCategory, listCategories, updateCategory } from '@/api/categories'
import { NETWORK_ERROR, SERVER_ERROR } from '@/auth/errors'
import CategoryEditorDialog from '@/components/categories/CategoryEditorDialog.vue'
import type { TransactionType } from '@/types/budget'
import type { Category, CategoryCreate, CategoryUpdate } from '@/types/category'

vi.mock('@/api/categories', () => ({
  MAX_CATEGORIES: 100,
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
}))

const list = vi.mocked(listCategories)
const create = vi.mocked(createCategory)
const update = vi.mocked(updateCategory)

let uid = 0
function category(overrides: Partial<Category> = {}): Category {
  uid += 1
  return {
    uid: `uid-${uid}`,
    name: 'Продукты',
    money_plan: 4990,
    category_type: 'outcome',
    description: 'Покупки в магазинах',
    ...overrides,
  }
}

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig

function httpError(status: number, data: object = {}): AxiosError {
  return new AxiosError('Ошибка', String(status), config, null, {
    data: { status, ...data },
    status,
    statusText: '',
    headers: {},
    config,
  })
}

const networkError = () => new AxiosError('Network Error', 'ERR_NETWORK', config, {})

/** Промис, который тест разрешает сам — чтобы проверить состояние окна во время запроса. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

/** Ответ POST: созданная статья из тела запроса. */
function echo(body: CategoryCreate): Promise<Category> {
  return Promise.resolve(
    category({
      name: body.name,
      money_plan: body.money_plan ?? null,
      category_type: body.category_type,
      description: body.description ?? null,
    }),
  )
}

/** Ответ PATCH: статья с применёнными изменениями (исходная — из открытого окна). */
function patched(original: Category) {
  return (_uid: string, body: CategoryUpdate): Promise<Category> =>
    Promise.resolve({ ...original, ...body })
}

let wrapper: VueWrapper | undefined
const scrollIntoView = vi.fn<(arg?: boolean | ScrollIntoViewOptions) => void>()

// Окно вынесено в body настоящим Teleport: заглушка teleport пересоздаёт разметку окна при обновлениях,
// и найденные до сохранения элементы отрываются от документа. Поэтому всё ищется в document.body.
function page() {
  return new DOMWrapper(document.body)
}

/** Найденный элемент (`get` возвращает обёртку без `exists`). */
type Node = Omit<DOMWrapper<Element>, 'exists'>

async function mountDialog(
  data: Partial<Record<TransactionType, Category[]>> = {
    outcome: [category(), category({ name: 'ЖКХ', money_plan: 11500, description: null })],
    income: [
      category({
        name: 'Зарплата',
        money_plan: 200000,
        category_type: 'income',
        description: null,
      }),
    ],
  },
) {
  list.mockImplementation(async (type) => data[type] ?? [])
  wrapper = mount(CategoryEditorDialog, {
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

function column(title: 'Расходы' | 'Доходы') {
  const heading = page()
    .findAll('h3')
    .find((h) => h.text() === title)
  if (!heading) throw new Error(`Нет колонки «${title}»`)
  return page().get(`[aria-labelledby="${heading.attributes('id')}"]`)
}

function existingRow(col: Node, index: number) {
  const row = col.findAll('[data-testid="category-row"]')[index]
  if (!row) throw new Error(`Нет статьи ${index}`)
  return row
}

/** Значения полей существующих статей: название, план, комментарий (неразрывные пробелы — обычными). */
function existingRows(col: Node): string[][] {
  return col
    .findAll('[data-testid="category-row"]')
    .map((row) =>
      row
        .findAll<HTMLInputElement>('input')
        .map((field) => field.element.value.replace(/\u00a0/g, ' ')),
    )
}

function newRows(col: Node) {
  return col.findAll('[data-testid="new-row"]')
}

function input(row: Node, label: 'Название категории' | 'План' | 'Комментарий') {
  return row.get<HTMLInputElement>(`input[aria-label="${label}"]`)
}

type RowValues = { name?: string; plan?: string; description?: string }

async function fillRow(col: Node, index: number, values: RowValues) {
  const row = newRows(col)[index]
  if (!row) throw new Error(`Нет новой строки ${index}`)
  await fill(row, values)
}

async function editRow(col: Node, index: number, values: RowValues) {
  await fill(existingRow(col, index), values)
}

async function fill(row: Node, values: RowValues) {
  if (values.name !== undefined) await input(row, 'Название категории').setValue(values.name)
  if (values.plan !== undefined) await input(row, 'План').setValue(values.plan)
  if (values.description !== undefined) await input(row, 'Комментарий').setValue(values.description)
}

function button(name: string) {
  const found = page()
    .findAll('button')
    .find((b) => b.text() === name || b.attributes('aria-label') === name)
  if (!found) throw new Error(`Нет кнопки «${name}»`)
  return found
}

async function save() {
  await page().get('form').trigger('submit')
  await flushPromises()
}

describe('CategoryEditorDialog', () => {
  beforeEach(() => {
    create.mockImplementation(echo)
    // В jsdom нет scrollIntoView
    // TODO(FM-44): подмена не восстанавливается после тестов (Vitest изолирует файлы — пока безвредно), а тест
    // клиентской проверки не проверяет прокрутку строки — основной путь при многих статьях.
    Element.prototype.scrollIntoView = scrollIntoView
    scrollIntoView.mockClear()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.clearAllMocks()
  })

  it('окно с заголовком загружает статьи расходов и доходов', async () => {
    await mountDialog()

    const dialog = page().get('[role="dialog"]')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(
      page()
        .get(`#${dialog.attributes('aria-labelledby')}`)
        .text(),
    ).toBe('Редактирование категорий')
    expect(list).toHaveBeenCalledWith('outcome')
    expect(list).toHaveBeenCalledWith('income')
    expect(existingRows(column('Расходы'))).toEqual([
      ['Продукты', '4 990', 'Покупки в магазинах'],
      ['ЖКХ', '11 500', ''],
    ])
    expect(existingRows(column('Доходы'))).toEqual([['Зарплата', '200 000', '']])
  })

  // TODO(FM-44): тест сверяет точные классы Tailwind (раскладку jsdom не считает) — равнозначная замена, например
  // запасное значение `vh`, его сломает; содержательна структурная часть (заголовок и «Сохранить» вне прокрутки).
  it('окно не выше экрана: колонки прокручиваются, заголовок и «Сохранить» — на месте', async () => {
    await mountDialog()
    const panel = page().get('[role="dialog"]')
    const scroll = page().get('[data-testid="category-editor-scroll"]')

    // Выше экрана окно не растёт: иначе центрирование подложкой уводит заголовок за верхний край
    // Ограничение — только на экране от 540px: ниже прокрутке колонок осталось бы меньше строки, и окно
    // растёт целиком, прокручиваясь с подложкой
    expect(panel.classes()).toEqual(
      expect.arrayContaining([
        'flex',
        'flex-col',
        '[@media(min-height:540px)]:max-h-[calc(100dvh-4rem)]',
      ]),
    )
    expect(panel.classes()).not.toContain('max-h-[calc(100dvh-4rem)]')
    // relative: absolute-элементы колонок иначе позиционируются от панели, выходят из прокрутки
    // и растягивают подложку — на телефоне она прокручивается на высоту всех строк
    expect(scroll.classes()).toEqual(
      expect.arrayContaining(['relative', 'min-h-0', 'flex-1', 'overflow-y-auto']),
    )
    expect(scroll.findAll('h3').map((h) => h.text())).toEqual(['Расходы', 'Доходы'])
    expect(scroll.find('h2').exists()).toBe(false)
    expect(scroll.find('button[type="submit"]').exists()).toBe(false)
    expect(scroll.find('[data-testid="form-error"]').exists()).toBe(false)
  })

  it('окно выше экрана прокручивается с подложкой от своего верха: заголовок не уходит за край', async () => {
    // Центрирование подложкой (items-center) уводит верх высокого окна за край, куда не прокрутить;
    // отступы auto у панели центрируют, только пока окно помещается
    await mountDialog()
    const panel = page().get('[role="dialog"]')

    expect(panel.classes()).toContain('sm:my-auto')
    expect(panel.element.parentElement!.className).not.toMatch(/(^|\s)(sm:)?items-center(\s|$)/)
  })

  it('у существующих статей — поля со значениями, пустой комментарий показывает подсказку', async () => {
    await mountDialog()

    const row = existingRow(column('Расходы'), 1)
    expect(input(row, 'Название категории').element.value).toBe('ЖКХ')
    expect(input(row, 'Комментарий').element.value).toBe('')
    expect(input(row, 'Комментарий').attributes('placeholder')).toBe('Комментарий')
    // Как в макете: у плана знак ₽ у правого края поля
    expect(row.text()).toContain('₽')
  })

  it('у каждой колонки одна пустая строка для новой статьи', async () => {
    await mountDialog()

    for (const title of ['Расходы', 'Доходы'] as const) {
      const col = column(title)
      const [row] = newRows(col)
      expect(newRows(col)).toHaveLength(1)
      expect(input(row!, 'Название категории').attributes('placeholder')).toBe('Название категории')
      expect(input(row!, 'План').attributes('placeholder')).toBe('План')
      expect(input(row!, 'Комментарий').attributes('placeholder')).toBe('Комментарий')
    }
  })

  it('статья без плана — пустое поле плана с подсказкой, без знака ₽', async () => {
    await mountDialog({ outcome: [category({ money_plan: null, description: null })] })

    const row = existingRow(column('Расходы'), 0)
    expect(input(row, 'План').element.value).toBe('')
    expect(input(row, 'План').attributes('placeholder')).toBe('План')
    expect(row.text()).not.toContain('₽')
  })

  it('пустая колонка — подсказка и строка для новой статьи', async () => {
    await mountDialog({ outcome: [] })

    const col = column('Расходы')
    expect(col.text()).toContain('Статей расходов пока нет')
    expect(newRows(col)).toHaveLength(1)
    expect(column('Доходы').text()).toContain('Статей доходов пока нет')
  })

  it('во время загрузки — «Загрузка…», полей и кнопки «Сохранить» нет', async () => {
    const pending = deferred<Category[]>()
    list.mockReturnValue(pending.promise)
    wrapper = mount(CategoryEditorDialog, {
      attachTo: document.body,
    })
    await flushPromises()

    expect(page().get('[role="status"]').text()).toBe('Загрузка…')
    expect(page().findAll('input')).toHaveLength(0)
    expect(
      page()
        .findAll('button')
        .map((b) => b.text()),
    ).not.toContain('Сохранить')
  })

  it('ошибка загрузки — сообщение и «Повторить», повтор загружает статьи', async () => {
    list.mockRejectedValue(networkError())
    wrapper = mount(CategoryEditorDialog, {
      attachTo: document.body,
    })
    await flushPromises()

    expect(page().get('[role="alert"]').text()).toBe('Не удалось загрузить статьи')
    list.mockResolvedValue([category()])
    await button('Повторить').trigger('click')
    await flushPromises()

    expect(existingRows(column('Расходы'))).toHaveLength(1)
  })

  it('ввод в пустую строку добавляет под ней следующую пустую', async () => {
    await mountDialog()
    const col = column('Расходы')

    await fillRow(col, 0, { plan: '100' })

    expect(newRows(col)).toHaveLength(2)
    await fillRow(col, 0, { name: 'Кафе' })
    expect(newRows(col)).toHaveLength(2)
    await fillRow(col, 1, { description: 'x' })
    expect(newRows(col)).toHaveLength(3)
  })

  it('у заполненного плана в поле есть знак ₽', async () => {
    await mountDialog()
    const col = column('Расходы')

    expect(newRows(col)[0]!.text()).not.toContain('₽')
    await fillRow(col, 0, { plan: '100' })

    expect(newRows(col)[0]!.text()).toContain('₽')
  })

  it('«Сохранить» создаёт статью на каждую заполненную строку с типом своей колонки', async () => {
    await mountDialog()
    await fillRow(column('Расходы'), 0, {
      name: '  Кафе ',
      plan: '5 000',
      description: 'Доставка',
    })
    await fillRow(column('Расходы'), 1, { name: 'Подарки' })
    await fillRow(column('Доходы'), 0, { name: 'Подработка', plan: '0' })

    await save()

    expect(create).toHaveBeenCalledTimes(3)
    expect(create).toHaveBeenCalledWith({
      name: 'Кафе',
      money_plan: 5000,
      category_type: 'outcome',
      description: 'Доставка',
    })
    expect(create).toHaveBeenCalledWith({
      name: 'Подарки',
      money_plan: null,
      category_type: 'outcome',
      description: null,
    })
    expect(create).toHaveBeenCalledWith({
      name: 'Подработка',
      money_plan: 0,
      category_type: 'income',
      description: null,
    })
  })

  it('после полного успеха сообщает о сохранении и закрывается', async () => {
    const w = await mountDialog()
    await fillRow(column('Расходы'), 0, { name: 'Кафе' })

    await save()

    expect(w.emitted('saved')).toHaveLength(1)
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('без новых строк «Сохранить» просто закрывает окно, запросов нет', async () => {
    const w = await mountDialog()

    await save()

    expect(create).not.toHaveBeenCalled()
    expect(w.emitted('saved')).toBeUndefined()
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('ошибки ввода показываются у полей, запросы не уходят', async () => {
    const w = await mountDialog()
    const col = column('Расходы')
    await fillRow(col, 0, { plan: '1.5', description: 'без названия' })
    await fillRow(column('Доходы'), 0, { name: 'Зарплата' })

    await save()

    expect(create).not.toHaveBeenCalled()
    const row = newRows(col)[0]!
    expect(row.text()).toContain('Введите название')
    expect(row.text()).toContain('Введите целое число рублей не меньше 0')
    expect(input(row, 'Название категории').attributes('aria-invalid')).toBe('true')
    expect(input(row, 'План').attributes('aria-invalid')).toBe('true')
    expect(newRows(column('Доходы'))[0]!.text()).toContain('Такая статья уже есть')
    expect(w.emitted('close')).toBeUndefined()
  })

  it('после «Сохранить» с ошибками фокус — в первом поле с ошибкой: браузер докрутит к нему колонки', async () => {
    // При многих статьях строка с ошибкой может быть за пределами видимой части прокрутки
    await mountDialog()
    await fillRow(column('Расходы'), 0, { name: 'Транспорт' })
    await fillRow(column('Доходы'), 0, { name: 'Премия', plan: 'abc' })

    await save()

    const row = newRows(column('Доходы'))[0]!
    expect(document.activeElement).toBe(input(row, 'План').element)
  })

  it('ошибка сервера в строке: фокус — в её поле, строка с текстом ошибки докручена в видимую часть', async () => {
    // focus() не прокручивает уже видимое поле, а текст ошибки под ним может остаться за краем прокрутки
    await mountDialog()
    create.mockRejectedValueOnce(httpError(409, { code: 'FM-409101' }))
    await fillRow(column('Доходы'), 0, { name: 'Премия' })

    await save()

    const row = newRows(column('Доходы'))[0]!
    expect(document.activeElement).toBe(input(row, 'Название категории').element)
    expect(scrollIntoView.mock.contexts).toEqual([row.element])
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('ошибка строки без поля (лимит статей): фокус — в её первое поле, строка докручена', async () => {
    await mountDialog()
    await fillRow(column('Расходы'), 0, { name: 'Кафе' })
    await fillRow(column('Доходы'), 0, { name: 'Бонус' })
    create.mockImplementation((body) =>
      body.name === 'Бонус' ? Promise.reject(httpError(409, { code: 'FM-409103' })) : echo(body),
    )

    await save()

    const row = newRows(column('Доходы'))[0]!
    expect(row.text()).toContain('Достигнут лимит в 100 статей')
    expect(document.activeElement).toBe(input(row, 'Название категории').element)
    expect(scrollIntoView.mock.contexts).toEqual([row.element])
  })

  it('общая ошибка (нет связи): фокус — на «Сохранить», рядом с сообщением, а не на крестике вверху', async () => {
    await mountDialog()
    await fillRow(column('Расходы'), 0, { name: 'Кафе' })
    create.mockRejectedValue(networkError())

    await save()

    expect(page().get('[data-testid="form-error"]').text()).toBe(NETWORK_ERROR)
    expect(document.activeElement).toBe(page().get('button[type="submit"]').element)
  })

  it('одинаковые новые строки в колонке — ошибка у второй', async () => {
    await mountDialog()
    const col = column('Расходы')
    await fillRow(col, 0, { name: 'Кафе' })
    await fillRow(col, 1, { name: ' Кафе' })

    await save()

    expect(create).not.toHaveBeenCalled()
    expect(newRows(col)[0]!.text()).not.toContain('Такая статья уже есть')
    expect(newRows(col)[1]!.text()).toContain('Такая статья уже есть')
  })

  it('частичная ошибка: сохранённая строка переходит в список, у несохранённой — ошибка', async () => {
    const w = await mountDialog()
    const col = column('Расходы')
    await fillRow(col, 0, { name: 'Кафе', plan: '300' })
    await fillRow(col, 1, { name: 'Такси' })
    await fillRow(column('Доходы'), 0, { name: 'Бонус' })
    create.mockImplementation((body) => {
      if (body.name === 'Такси') return Promise.reject(httpError(409, { code: 'FM-409101' }))
      if (body.name === 'Бонус') return Promise.reject(httpError(409, { code: 'FM-409103' }))
      return echo(body)
    })

    await save()

    expect(existingRows(col).map(([name]) => name)).toEqual(['Продукты', 'ЖКХ', 'Кафе'])
    expect(newRows(col).map((row) => input(row, 'Название категории').element.value)).toEqual([
      'Такси',
      '',
    ])
    expect(newRows(col)[0]!.text()).toContain('Такая статья уже есть')
    expect(newRows(column('Доходы'))[0]!.text()).toContain('Достигнут лимит в 100 статей')
    expect(w.emitted('saved')).toHaveLength(1)
    expect(w.emitted('close')).toBeUndefined()
  })

  it.each([
    ['нет связи', networkError, NETWORK_ERROR],
    ['5xx', () => httpError(500), SERVER_ERROR],
  ])('ошибка «%s» — общим сообщением в окне, строка остаётся', async (_, error, message) => {
    const w = await mountDialog()
    const col = column('Расходы')
    await fillRow(col, 0, { name: 'Кафе' })
    create.mockRejectedValue(error())

    await save()

    expect(page().get('[data-testid="form-error"]').text()).toBe(message)
    expect(input(newRows(col)[0]!, 'Название категории').element.value).toBe('Кафе')
    expect(w.emitted('saved')).toBeUndefined()
  })

  it('422 от сервера — ошибка у поля из validation', async () => {
    await mountDialog()
    const col = column('Расходы')
    await fillRow(col, 0, { name: 'Кафе' })
    create.mockRejectedValue(
      httpError(422, { code: 'FM-422000', validation: [{ field: 'name', message: 'bad' }] }),
    )

    await save()

    expect(newRows(col)[0]!.text()).toContain('Проверьте название')
  })

  it('во время сохранения повторное нажатие не отправляет второй запрос', async () => {
    await mountDialog()
    await fillRow(column('Расходы'), 0, { name: 'Кафе' })
    const pending = deferred<Category>()
    create.mockReturnValue(pending.promise)

    await page().get('form').trigger('submit')
    await page().get('form').trigger('submit')

    expect(create).toHaveBeenCalledTimes(1)
    expect(button('Сохранить').attributes('aria-busy')).toBe('true')
    pending.resolve(category({ name: 'Кафе' }))
    await flushPromises()
  })

  describe('изменение существующих статей', () => {
    beforeEach(() => {
      update.mockImplementation((uid, body) =>
        Promise.resolve({ ...category({ uid }), ...body } as Category),
      )
    })

    it('«Сохранить» отправляет PATCH только с изменёнными полями', async () => {
      const outcome = [category(), category({ name: 'ЖКХ', money_plan: 11500, description: null })]
      await mountDialog({ outcome })
      await editRow(column('Расходы'), 0, { name: ' Еда ', plan: '5 000' })
      await editRow(column('Расходы'), 1, { description: 'Квартира' })

      await save()

      expect(update).toHaveBeenCalledTimes(2)
      expect(update).toHaveBeenCalledWith(outcome[0]!.uid, { name: 'Еда', money_plan: 5000 })
      expect(update).toHaveBeenCalledWith(outcome[1]!.uid, { description: 'Квартира' })
      expect(create).not.toHaveBeenCalled()
    })

    it('очищенные план и комментарий отправляются как null', async () => {
      const outcome = [category()]
      await mountDialog({ outcome })
      await editRow(column('Расходы'), 0, { plan: '', description: '' })

      await save()

      expect(update).toHaveBeenCalledWith(outcome[0]!.uid, { money_plan: null, description: null })
    })

    it('строки, вернувшиеся к исходным значениям, не отправляются; без изменений окно закрывается', async () => {
      const w = await mountDialog()
      // План введён без разделителя разрядов — значение то же
      await editRow(column('Расходы'), 0, { name: 'Еда', plan: '4990' })
      await editRow(column('Расходы'), 0, { name: 'Продукты' })

      await save()

      expect(update).not.toHaveBeenCalled()
      expect(create).not.toHaveBeenCalled()
      expect(w.emitted('saved')).toBeUndefined()
      expect(w.emitted('close')).toHaveLength(1)
    })

    it('PATCH и POST уходят параллельно; после успеха — saved и закрытие', async () => {
      const w = await mountDialog()
      const pendingUpdate = deferred<Category>()
      const pendingCreate = deferred<Category>()
      update.mockReturnValue(pendingUpdate.promise)
      create.mockReturnValue(pendingCreate.promise)
      await editRow(column('Расходы'), 0, { name: 'Еда' })
      await fillRow(column('Доходы'), 0, { name: 'Бонус' })

      await page().get('form').trigger('submit')

      expect(update).toHaveBeenCalledTimes(1)
      expect(create).toHaveBeenCalledTimes(1)
      pendingUpdate.resolve(category({ name: 'Еда' }))
      pendingCreate.resolve(category({ name: 'Бонус', category_type: 'income' }))
      await flushPromises()
      expect(w.emitted('saved')).toHaveLength(1)
      expect(w.emitted('close')).toHaveLength(1)
    })

    it.each([
      ['другой статьи', 'ЖКХ'],
      ['новой строки', 'Кафе'],
    ])(
      'переименование в название %s колонки — «Такая статья уже есть» до отправки',
      async (_, name) => {
        const w = await mountDialog()
        const col = column('Расходы')
        await fillRow(col, 0, { name: 'Кафе' })
        await editRow(col, 0, { name })

        await save()

        expect(update).not.toHaveBeenCalled()
        expect(create).not.toHaveBeenCalled()
        expect(existingRow(col, 0).text()).toContain('Такая статья уже есть')
        expect(input(existingRow(col, 0), 'Название категории').attributes('aria-invalid')).toBe(
          'true',
        )
        expect(existingRow(col, 1).text()).not.toContain('Такая статья уже есть')
        expect(newRows(col)[0]!.text()).not.toContain('Такая статья уже есть')
        expect(w.emitted('close')).toBeUndefined()
      },
    )

    it('название другой колонки не дубликат', async () => {
      await mountDialog()
      await editRow(column('Расходы'), 0, { name: 'Зарплата' })

      await save()

      expect(update).toHaveBeenCalledTimes(1)
    })

    it('ошибки ввода — как у новых строк, у полей, запросы не уходят', async () => {
      await mountDialog()
      const col = column('Расходы')
      await editRow(col, 0, { name: ' ', plan: '1.5' })

      await save()

      expect(update).not.toHaveBeenCalled()
      const row = existingRow(col, 0)
      expect(row.text()).toContain('Введите название')
      expect(row.text()).toContain('Введите целое число рублей не меньше 0')
      expect(document.activeElement).toBe(input(row, 'Название категории').element)
    })

    it.each([
      ['409 дубликат', () => httpError(409, { code: 'FM-409101' }), 'Такая статья уже есть'],
      [
        '422 по полю',
        () => httpError(422, { code: 'FM-422000', validation: [{ field: 'money_plan' }] }),
        'Проверьте план',
      ],
      ['404 — статья удалена', () => httpError(404, { code: 'FM-404100' }), 'Статья удалена'],
    ])('ошибка сервера «%s» — у строки, фокус в ней', async (_, error, text) => {
      await mountDialog()
      const col = column('Расходы')
      update.mockRejectedValue(error())
      await editRow(col, 1, { plan: '700' })

      await save()

      const row = existingRow(col, 1)
      expect(row.text()).toContain(text)
      expect(row.element.contains(document.activeElement)).toBe(true)
      expect(page().find('[data-testid="form-error"]').exists()).toBe(false)
    })

    it.each([
      ['нет связи', networkError, NETWORK_ERROR],
      ['5xx', () => httpError(503), SERVER_ERROR],
    ])('ошибка «%s» — общим сообщением окна, фокус на «Сохранить»', async (_, error, message) => {
      await mountDialog()
      update.mockRejectedValue(error())
      await editRow(column('Расходы'), 0, { name: 'Еда' })

      await save()

      expect(page().get('[data-testid="form-error"]').text()).toBe(message)
      expect(existingRows(column('Расходы'))[0]![0]).toBe('Еда')
      expect(document.activeElement).toBe(page().get('button[type="submit"]').element)
    })

    it('частичный успех: сохранённые строки — значения из ответа, у несохранённой — ввод и ошибка', async () => {
      const outcome = [category(), category({ name: 'ЖКХ', money_plan: 11500, description: null })]
      const w = await mountDialog({ outcome })
      const col = column('Расходы')
      update.mockImplementation((uid, body) =>
        uid === outcome[1]!.uid
          ? Promise.reject(httpError(409, { code: 'FM-409101' }))
          : // Сервер возвращает статью в своём виде: комментарий без изменений, план из тела
            patched(outcome[0]!)(uid, { ...body, description: 'С сервера' }),
      )
      await editRow(col, 0, { plan: '6000' })
      await editRow(col, 1, { name: 'Коммуналка' })

      await save()

      expect(existingRows(col)).toEqual([
        ['Продукты', '6 000', 'С сервера'],
        ['Коммуналка', '11 500', ''],
      ])
      expect(existingRow(col, 1).text()).toContain('Такая статья уже есть')
      expect(w.emitted('saved')).toHaveLength(1)
      expect(w.emitted('close')).toBeUndefined()

      // Сохранённая строка теперь исходная: повторное «Сохранить» отправляет только несохранённую
      update.mockClear()
      update.mockImplementation(patched(outcome[1]!))
      await save()
      expect(update).toHaveBeenCalledTimes(1)
      expect(update).toHaveBeenCalledWith(outcome[1]!.uid, { name: 'Коммуналка' })
      expect(w.emitted('close')).toHaveLength(1)
    })
  })

  it('✕ и Escape закрывают окно без сохранения', async () => {
    const w = await mountDialog()
    await button('Закрыть').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)

    await page().get('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('close')).toHaveLength(2)
    expect(create).not.toHaveBeenCalled()
  })

  it('во время сохранения окно не закрывается: иначе «saved» не дойдёт и таблица не обновится', async () => {
    const w = await mountDialog()
    await fillRow(column('Расходы'), 0, { name: 'Кафе' })
    const pending = deferred<Category>()
    create.mockReturnValue(pending.promise)
    await page().get('form').trigger('submit')

    expect(button('Закрыть').attributes('disabled')).toBeDefined()
    await page().get('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('close')).toBeUndefined()

    pending.resolve(category({ name: 'Кафе' }))
    await flushPromises()
    expect(w.emitted('saved')).toHaveLength(1)
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('частичная ошибка: фокус остаётся в окне, хотя сохранённая строка с фокусом убрана', async () => {
    await mountDialog()
    const col = column('Расходы')
    await fillRow(col, 0, { name: 'Кафе' })
    await fillRow(col, 1, { name: 'Такси' })
    create.mockImplementation((body) =>
      body.name === 'Такси' ? Promise.reject(httpError(409, { code: 'FM-409101' })) : echo(body),
    )
    input(newRows(col)[0]!, 'Название категории').element.focus()

    await save()

    expect(page().get('[role="dialog"]').element.contains(document.activeElement)).toBe(true)
  })

  it('во время сохранения поля всех строк только для чтения, после ответа — снова доступны', async () => {
    await mountDialog()
    const col = column('Расходы')
    await fillRow(col, 0, { name: 'Кафе' })
    await fillRow(col, 1, { name: 'Такси' })
    const pending = deferred<Category>()
    create.mockImplementation((body) =>
      body.name === 'Такси' ? pending.promise : Promise.reject(httpError(500)),
    )

    await page().get('form').trigger('submit')

    const fields = () => col.findAll('input')
    expect(fields().every((field) => field.attributes('readonly') !== undefined)).toBe(true)
    pending.resolve(category({ name: 'Такси' }))
    await flushPromises()
    expect(fields().some((field) => field.attributes('readonly') !== undefined)).toBe(false)
  })

  it('фокус: при открытии — в окне, Tab с последнего элемента переходит на первый', async () => {
    await mountDialog()
    const dialog = page().get('[role="dialog"]')
    expect(dialog.element.contains(document.activeElement)).toBe(true)

    const focusable = dialog.findAll('input, button')
    const last = focusable[focusable.length - 1]!
    ;(last.element as HTMLElement).focus()
    await dialog.trigger('keydown', { key: 'Tab' })

    expect(document.activeElement).toBe(focusable[0]!.element)
  })

  it('пока окно открыто, приложение под ним inert', async () => {
    const app = document.createElement('div')
    app.id = 'app'
    document.body.appendChild(app)
    try {
      const w = await mountDialog()
      expect(app.hasAttribute('inert')).toBe(true)
      w.unmount()
      wrapper = undefined
      expect(app.hasAttribute('inert')).toBe(false)
    } finally {
      app.remove()
    }
  })
})
