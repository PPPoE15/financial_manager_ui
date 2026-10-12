import { isAxiosError } from 'axios'
import { computed, reactive, ref, type ComputedRef, type Ref } from 'vue'

import { updateCurrentUser } from '@/api/auth'
import { createStartingBalance, getStartingBalance } from '@/api/balance'
import { GENERIC_ERROR, NETWORK_ERROR, SERVER_ERROR } from '@/auth/errors'
import { parseAmount, validateName } from '@/firstStep/validation'
import { useSessionStore } from '@/stores/session'

/** Поля окна «Первый шаг» в том виде, как их ввёл пользователь. */
export interface FirstStepForm {
  name: string
  amount: string
}

type FirstStepField = keyof FirstStepForm

const STARTING_BALANCE_MISSING = 'FM-404201'
const STARTING_BALANCE_EXISTS = 'FM-409201'

// Сообщения бэкенда в 422 — от pydantic на английском, поэтому у поля показываем свои
const FIELD_FORMAT_ERRORS: Record<FirstStepField, string> = {
  name: 'Проверьте имя: от 1 до 64 символов, без служебных символов',
  amount: 'Проверьте сумму: целое число от −1 000 000 000 до 1 000 000 000 ₽',
}

/** Ошибка сохранения одного блока: у поля или общим сообщением в окне. */
type SaveError = { fieldError: string; message?: never } | { message: string; fieldError?: never }

function hasCode(error: unknown, status: number, code: string): boolean {
  if (!isAxiosError(error) || error.response?.status !== status) return false
  const data = error.response.data as { code?: string } | undefined
  return data?.code === code
}

function mapSaveError(error: unknown, field: FirstStepField): SaveError {
  if (!isAxiosError(error)) return { message: GENERIC_ERROR }
  if (!error.response) return { message: NETWORK_ERROR }
  const { status } = error.response
  if (status >= 500) return { message: SERVER_ERROR }
  // В теле запроса только одно поле, поэтому любой 422 относится к нему
  if (status === 422) return { fieldError: FIELD_FORMAT_ERRORS[field] }
  return { message: GENERIC_ERROR }
}

export interface FirstStep {
  /** Блок «Как Вас зовут?» ещё не заполнен. */
  needName: Ref<boolean>
  /** Блок «Ваш текущий бюджет?» ещё не заполнен. */
  needBalance: Ref<boolean>
  visible: ComputedRef<boolean>
  form: FirstStepForm
  errors: Ref<Partial<Record<FirstStepField, string>>>
  message: Ref<string | null>
  submitting: Ref<boolean>
  check: () => Promise<void>
  submit: () => Promise<void>
}

/**
 * Окно «Первый шаг»: какие блоки нужно заполнить (имени нет — `name = null`, остатка нет — 404 на
 * `GET /starting-balance`) и их отправка. Каждый блок сохраняется своим запросом; сохранённый блок
 * из окна убирается, так что при частичном успехе повтор отправляет только оставшийся.
 */
export function useFirstStep(): FirstStep {
  const session = useSessionStore()

  const needName = ref(false)
  const needBalance = ref(false)
  const visible = computed(() => needName.value || needBalance.value)

  const form = reactive<FirstStepForm>({ name: '', amount: '' })
  const errors = ref<Partial<Record<FirstStepField, string>>>({})
  const message = ref<string | null>(null)
  const submitting = ref(false)

  // NOTE(FM-39): если остаток проверить не удалось (сеть, 5xx), блок суммы не показываем — не держим
  // пользователя в обязательном окне из-за сбоя; окно появится при следующем открытии главной.
  async function isStartingBalanceMissing(): Promise<boolean> {
    try {
      await getStartingBalance()
      return false
    } catch (error) {
      return hasCode(error, 404, STARTING_BALANCE_MISSING)
    }
  }

  async function check(): Promise<void> {
    // Без загруженного пользователя (GET /me не удался) имя неизвестно — блок имени не показываем
    const nameMissing = session.user !== null && session.user.name === null
    const balanceMissing = await isStartingBalanceMissing()
    // Оба флага выставляются вместе, чтобы окно не появилось сначала с одним блоком, а потом с двумя
    needName.value = nameMissing
    needBalance.value = balanceMissing
  }

  function fail(field: FirstStepField, error: SaveError): void {
    if (error.fieldError) errors.value = { ...errors.value, [field]: error.fieldError }
    else message.value = error.message ?? GENERIC_ERROR
  }

  async function saveName(name: string): Promise<void> {
    try {
      session.setUser(await updateCurrentUser({ name }))
      needName.value = false
    } catch (error) {
      fail('name', mapSaveError(error, 'name'))
    }
  }

  async function saveBalance(amount: number): Promise<void> {
    try {
      await createStartingBalance({ amount })
      needBalance.value = false
    } catch (error) {
      // Остаток уже задан (например, в другой вкладке) — для окна блок выполнен
      if (hasCode(error, 409, STARTING_BALANCE_EXISTS)) needBalance.value = false
      else fail('amount', mapSaveError(error, 'amount'))
    }
  }

  async function submit(): Promise<void> {
    // Повторное нажатие (двойной клик, Enter во время запроса) не уходит вторым запросом
    if (submitting.value) return

    message.value = null
    const name = needName.value ? validateName(form.name) : undefined
    const amount = needBalance.value ? parseAmount(form.amount) : undefined
    errors.value = {
      ...(name?.error && { name: name.error }),
      ...(amount?.error && { amount: amount.error }),
    }
    if (Object.keys(errors.value).length) return

    submitting.value = true
    try {
      await Promise.all([
        name?.value !== undefined && saveName(name.value),
        amount?.value !== undefined && saveBalance(amount.value),
      ])
    } finally {
      submitting.value = false
    }
  }

  return { needName, needBalance, visible, form, errors, message, submitting, check, submit }
}
