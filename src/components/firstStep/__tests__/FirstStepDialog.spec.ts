import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'

import { updateCurrentUser } from '@/api/auth'
import { createStartingBalance, getStartingBalance } from '@/api/balance'
import { NETWORK_ERROR } from '@/auth/errors'
import FirstStepDialog from '@/components/firstStep/FirstStepDialog.vue'
import { useSessionStore } from '@/stores/session'
import type { User } from '@/types/user'

vi.mock('@/api/auth', () => ({ updateCurrentUser: vi.fn() }))
vi.mock('@/api/balance', () => ({ getStartingBalance: vi.fn(), createStartingBalance: vi.fn() }))

const NAME_LABEL = 'Как Вас зовут?'
const AMOUNT_LABEL = 'Ваш текущий бюджет?'

const withoutName: User = { uid: 'u', name: null, email: 'a@example.com' }
const withName: User = { ...withoutName, name: 'Артём' }
const balance = { amount: 120000, balance_date: '2026-10-11' }

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

const notFound = () => httpError(404, { code: 'FM-404201' })
const networkError = () => new AxiosError('Network Error', 'ERR_NETWORK', config, {})

function validationError(field: string): AxiosError {
  return httpError(422, { code: 'FM-422000', validation: [{ field, message: 'bad', rule: 'x' }] })
}

/** Промис, который тест разрешает сам — чтобы проверить состояние окна во время запроса. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

let wrapper: VueWrapper | undefined

async function mountDialog(user: User | null, startingBalance: 'missing' | 'set' | 'error') {
  if (user) useSessionStore().setUser(user)
  if (startingBalance === 'missing') vi.mocked(getStartingBalance).mockRejectedValue(notFound())
  else if (startingBalance === 'set') vi.mocked(getStartingBalance).mockResolvedValue(balance)
  else vi.mocked(getStartingBalance).mockRejectedValue(httpError(500))

  wrapper = mount(FirstStepDialog, {
    attachTo: document.body,
    global: { stubs: { teleport: true } },
  })
  await flushPromises()
  return wrapper
}

function dialog(w: VueWrapper) {
  return w.find('[role="dialog"]')
}

function labels(w: VueWrapper): string[] {
  return w.findAll('label').map((l) => l.text())
}

function field(w: VueWrapper, label: string) {
  const labelEl = w.findAll('label').find((l) => l.text() === label)
  if (!labelEl) throw new Error(`Нет поля «${label}»`)
  return w.get<HTMLInputElement>(`#${labelEl.attributes('for')}`)
}

function fieldError(w: VueWrapper, label: string): string | null {
  const ids = field(w, label).attributes('aria-describedby')?.split(' ') ?? []
  const error = ids.map((id) => w.find(`#${id}[role="alert"]`)).find((e) => e.exists())
  return error ? error.text() : null
}

function submitButton(w: VueWrapper) {
  return w.get('form button[type="submit"]')
}

async function submit(w: VueWrapper) {
  await w.get('form').trigger('submit')
  await flushPromises()
}

describe('FirstStepDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
  })

  describe('показ окна', () => {
    it.each([
      {
        name: 'нет имени и нет остатка',
        user: withoutName,
        start: 'missing',
        shown: [NAME_LABEL, AMOUNT_LABEL],
      },
      { name: 'нет имени, остаток задан', user: withoutName, start: 'set', shown: [NAME_LABEL] },
      { name: 'имя есть, нет остатка', user: withName, start: 'missing', shown: [AMOUNT_LABEL] },
      {
        name: 'нет имени, остаток не удалось проверить',
        user: withoutName,
        start: 'error',
        shown: [NAME_LABEL],
      },
      {
        name: 'пользователь не загружен, нет остатка',
        user: null,
        start: 'missing',
        shown: [AMOUNT_LABEL],
      },
    ] as const)('$name — показывает только незаполненные блоки', async ({ user, start, shown }) => {
      const w = await mountDialog(user, start)

      expect(dialog(w).exists()).toBe(true)
      expect(labels(w)).toEqual(shown)
    })

    it.each([
      { name: 'имя есть и остаток задан', user: withName, start: 'set' },
      { name: 'имя есть, остаток не удалось проверить', user: withName, start: 'error' },
      { name: 'пользователь не загружен, остаток задан', user: null, start: 'set' },
    ] as const)('$name — окна нет', async ({ user, start }) => {
      const w = await mountDialog(user, start)

      expect(dialog(w).exists()).toBe(false)
    })

    it('тексты из макета «Приветствие»', async () => {
      const w = await mountDialog(withoutName, 'missing')

      expect(dialog(w).attributes('aria-modal')).toBe('true')
      expect(w.get('h2').text()).toBe('Первый шаг')
      expect(dialog(w).attributes('aria-labelledby')).toBe(w.get('h2').attributes('id'))
      expect(w.text()).toContain('Хотим обращаться к Вам по имени')
      expect(w.text()).toContain('Для начала отсчета')
      expect(field(w, NAME_LABEL).attributes('placeholder')).toBe('Ваше имя')
      expect(field(w, AMOUNT_LABEL).attributes('placeholder')).toBe('Сумма накоплений')
      expect(w.text()).toContain('₽')
      expect(submitButton(w).text()).toBe('Приступим')
    })
  })

  describe('отправка', () => {
    it('сохраняет имя и сумму, закрывает окно и обновляет пользователя', async () => {
      vi.mocked(updateCurrentUser).mockResolvedValue(withName)
      vi.mocked(createStartingBalance).mockResolvedValue({ ...balance, amount: -5000 })
      const w = await mountDialog(withoutName, 'missing')

      await field(w, NAME_LABEL).setValue('  Артём ')
      await field(w, AMOUNT_LABEL).setValue('−5 000')
      await submit(w)

      expect(updateCurrentUser).toHaveBeenCalledWith({ name: 'Артём' })
      expect(createStartingBalance).toHaveBeenCalledWith({ amount: -5000 })
      expect(useSessionStore().user?.name).toBe('Артём')
      expect(dialog(w).exists()).toBe(false)
    })

    it('отправляет только запрос незаполненного блока', async () => {
      vi.mocked(createStartingBalance).mockResolvedValue(balance)
      const w = await mountDialog(withName, 'missing')

      await field(w, AMOUNT_LABEL).setValue('120 000')
      await submit(w)

      expect(updateCurrentUser).not.toHaveBeenCalled()
      expect(createStartingBalance).toHaveBeenCalledWith({ amount: 120000 })
      expect(dialog(w).exists()).toBe(false)
    })

    it('ошибки клиентской проверки — у полей, запросы не уходят', async () => {
      const w = await mountDialog(withoutName, 'missing')

      await field(w, NAME_LABEL).setValue('   ')
      await field(w, AMOUNT_LABEL).setValue('100,50')
      await submit(w)

      expect(fieldError(w, NAME_LABEL)).toBe('Введите имя')
      expect(fieldError(w, AMOUNT_LABEL)).toBe('Введите целое число рублей')
      expect(field(w, NAME_LABEL).attributes('aria-invalid')).toBe('true')
      expect(updateCurrentUser).not.toHaveBeenCalled()
      expect(createStartingBalance).not.toHaveBeenCalled()
    })

    it('422 от сервера — ошибка у соответствующего поля', async () => {
      vi.mocked(updateCurrentUser).mockRejectedValue(validationError('name'))
      vi.mocked(createStartingBalance).mockRejectedValue(validationError('amount'))
      const w = await mountDialog(withoutName, 'missing')

      await field(w, NAME_LABEL).setValue('Артём')
      await field(w, AMOUNT_LABEL).setValue('100')
      await submit(w)

      expect(fieldError(w, NAME_LABEL)).toBe(
        'Проверьте имя: от 1 до 64 символов, без служебных символов',
      )
      expect(fieldError(w, AMOUNT_LABEL)).toBe(
        'Проверьте сумму: целое число от −1 000 000 000 до 1 000 000 000 ₽',
      )
      expect(w.find('[data-testid="form-error"]').exists()).toBe(false)
      expect(dialog(w).exists()).toBe(true)
    })

    it('409 FM-409201 (остаток уже задан) — блок суммы выполнен, окно закрывается', async () => {
      vi.mocked(createStartingBalance).mockRejectedValue(httpError(409, { code: 'FM-409201' }))
      const w = await mountDialog(withName, 'missing')

      await field(w, AMOUNT_LABEL).setValue('100')
      await submit(w)

      expect(dialog(w).exists()).toBe(false)
    })

    it('409 по сумме при ошибке имени — остаётся только блок имени', async () => {
      vi.mocked(updateCurrentUser).mockRejectedValue(validationError('name'))
      vi.mocked(createStartingBalance).mockRejectedValue(httpError(409, { code: 'FM-409201' }))
      const w = await mountDialog(withoutName, 'missing')

      await field(w, NAME_LABEL).setValue('Артём')
      await field(w, AMOUNT_LABEL).setValue('100')
      await submit(w)

      expect(labels(w)).toEqual([NAME_LABEL])
    })

    it('частичный успех — в окне остаётся только несохранённый блок, повтор отправляет только его', async () => {
      vi.mocked(updateCurrentUser).mockResolvedValue(withName)
      vi.mocked(createStartingBalance).mockRejectedValueOnce(networkError())
      const w = await mountDialog(withoutName, 'missing')

      await field(w, NAME_LABEL).setValue('Артём')
      await field(w, AMOUNT_LABEL).setValue('100')
      await submit(w)

      expect(labels(w)).toEqual([AMOUNT_LABEL])
      expect(field(w, AMOUNT_LABEL).element.value).toBe('100')
      expect(w.get('[data-testid="form-error"]').text()).toBe(NETWORK_ERROR)
      expect(useSessionStore().user?.name).toBe('Артём')

      vi.mocked(createStartingBalance).mockResolvedValue(balance)
      await submit(w)

      expect(updateCurrentUser).toHaveBeenCalledTimes(1)
      expect(createStartingBalance).toHaveBeenCalledTimes(2)
      expect(dialog(w).exists()).toBe(false)
    })

    it('сетевая ошибка — сообщение в окне, повтор той же кнопкой', async () => {
      vi.mocked(updateCurrentUser).mockRejectedValueOnce(networkError()).mockResolvedValue(withName)
      const w = await mountDialog(withoutName, 'set')

      await field(w, NAME_LABEL).setValue('Артём')
      await submit(w)

      expect(w.get('[data-testid="form-error"]').text()).toBe(NETWORK_ERROR)
      expect(dialog(w).exists()).toBe(true)

      await submit(w)

      expect(updateCurrentUser).toHaveBeenCalledTimes(2)
      expect(dialog(w).exists()).toBe(false)
    })

    it('прочий 409 по сумме — общее сообщение, блок остаётся', async () => {
      vi.mocked(createStartingBalance).mockRejectedValue(httpError(409, { code: 'FM-409999' }))
      const w = await mountDialog(withName, 'missing')

      await field(w, AMOUNT_LABEL).setValue('100')
      await submit(w)

      expect(labels(w)).toEqual([AMOUNT_LABEL])
      expect(w.get('[data-testid="form-error"]').text()).not.toBe('')
    })

    it('повторные нажатия во время запроса игнорируются', async () => {
      const pending = deferred<User>()
      vi.mocked(updateCurrentUser).mockReturnValue(pending.promise)
      const w = await mountDialog(withoutName, 'set')

      await field(w, NAME_LABEL).setValue('Артём')
      await w.get('form').trigger('submit')
      await w.get('form').trigger('submit')

      expect(submitButton(w).attributes('aria-busy')).toBe('true')
      expect(updateCurrentUser).toHaveBeenCalledTimes(1)

      pending.resolve(withName)
      await flushPromises()

      expect(dialog(w).exists()).toBe(false)
    })
  })

  describe('клавиатура и модальность', () => {
    it('во время сохранения фокус остаётся в окне, поля доступны только для чтения', async () => {
      const pending = deferred<User>()
      vi.mocked(updateCurrentUser).mockReturnValue(pending.promise)
      const w = await mountDialog(withoutName, 'set')
      await field(w, NAME_LABEL).setValue('Артём')
      ;(submitButton(w).element as HTMLElement).focus()
      await w.get('form').trigger('submit')
      await flushPromises()
      expect(field(w, NAME_LABEL).attributes('readonly')).toBeDefined()
      expect(document.activeElement).toBe(field(w, NAME_LABEL).element)
      pending.resolve(withName)
      await flushPromises()
    })

    it('при открытии фокус в первом поле', async () => {
      const w = await mountDialog(withoutName, 'missing')

      expect(document.activeElement).toBe(field(w, NAME_LABEL).element)
    })

    it('Tab с кнопки возвращает фокус в первое поле, Shift+Tab с первого поля — на кнопку', async () => {
      const w = await mountDialog(withoutName, 'missing')
      const first = field(w, NAME_LABEL)
      const button = submitButton(w)

      ;(button.element as HTMLElement).focus()
      await button.trigger('keydown', { key: 'Tab' })
      expect(document.activeElement).toBe(first.element)

      await first.trigger('keydown', { key: 'Tab', shiftKey: true })
      expect(document.activeElement).toBe(button.element)
    })

    it('Escape окно не закрывает', async () => {
      const w = await mountDialog(withoutName, 'missing')

      await dialog(w).trigger('keydown', { key: 'Escape' })

      expect(dialog(w).exists()).toBe(true)
    })

    it('пока окно открыто, приложение под ним недоступно (inert)', async () => {
      const app = document.createElement('div')
      app.id = 'app'
      document.body.append(app)
      vi.mocked(updateCurrentUser).mockResolvedValue(withName)
      const w = await mountDialog(withoutName, 'set')

      expect(app.hasAttribute('inert')).toBe(true)

      await field(w, NAME_LABEL).setValue('Артём')
      await submit(w)

      expect(app.hasAttribute('inert')).toBe(false)
    })
  })
})
