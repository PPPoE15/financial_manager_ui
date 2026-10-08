import { describe, expect, it } from 'vitest'
import { mount, type DOMWrapper } from '@vue/test-utils'

import BudgetStructureTable from '@/components/budget/BudgetStructureTable.vue'
import { budgetStructure, months } from './fixtures'

const NBSP = ' '
const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

function mountTable(data = budgetStructure()) {
  return mount(BudgetStructureTable, { props: { data } })
}

/** Видимые тексты ячеек строки (без пояснений для скринридера). */
function cells(row: DOMWrapper<Element>): string[] {
  return row
    .findAll('th, td')
    .map((cell) =>
      cell.find('[aria-hidden="true"]').exists()
        ? cell.find('[aria-hidden="true"]').text()
        : cell.text(),
    )
}

describe('BudgetStructureTable', () => {
  it('выводит колонки «Категория», «План», «Среднее» и 12 месяцев', () => {
    const headers = mountTable()
      .findAll('thead th')
      .map((th) => th.text())

    expect(headers).toEqual(['Категория', 'План', 'Среднее', ...MONTHS])
  })

  it('выводит строку на каждую статью и итоговую строку «сумма»', () => {
    const wrapper = mountTable()
    const bodyRows = wrapper.findAll('tbody tr')
    const footRows = wrapper.findAll('tfoot tr')

    expect(bodyRows.map((row) => row.get('th').text())).toEqual(['еда вне дома', 'подарки'])
    expect(footRows).toHaveLength(1)
    expect(cells(footRows[0]!).slice(0, 6)).toEqual([
      'сумма',
      `5${NBSP}000${NBSP}₽`,
      `5${NBSP}000${NBSP}₽`,
      `5${NBSP}000${NBSP}₽`,
      `5${NBSP}000${NBSP}₽`,
      `9${NBSP}436${NBSP}₽`,
    ])
  })

  it('факт месяца выводит суммой, будущий месяц (null) — прочерком', () => {
    const row = mountTable().findAll('tbody tr')[0]!

    expect(cells(row)).toEqual([
      'еда вне дома',
      `5${NBSP}000${NBSP}₽`,
      `5${NBSP}000${NBSP}₽`,
      `5${NBSP}000${NBSP}₽`,
      `5${NBSP}000${NBSP}₽`,
      `9${NBSP}436${NBSP}₽`,
      ...Array(9).fill('—'),
    ])
  })

  it('ноль в факте и среднем показывает как «0 ₽»', () => {
    const row = mountTable().findAll('tbody tr')[1]!

    expect(cells(row).slice(2, 6)).toEqual(Array(4).fill(`0${NBSP}₽`))
  })

  it('отсутствующий план показывает прочерком с пояснением, нулевой — как «0 ₽»', () => {
    const data = budgetStructure()
    data.rows[0]!.money_plan = 0
    const [zeroPlan, noPlan] = mountTable(data)
      .findAll('tbody tr')
      .map((row) => row.findAll('td')[0]!)

    expect(zeroPlan!.text()).toBe(`0${NBSP}₽`)
    expect(noPlan!.get('[aria-hidden="true"]').text()).toBe('—')
    expect(noPlan!.text()).toContain('план не задан')
    expect(noPlan!.classes()).not.toEqual(zeroPlan!.classes())
  })

  it('среднее без завершённых месяцев и будущий месяц поясняет для скринридера', () => {
    const data = budgetStructure({
      rows: [
        {
          category: { uid: 'u', name: 'ЖКХ' },
          money_plan: 100,
          average: null,
          months: months(100),
        },
      ],
      total: { money_plan: 100, average: null, months: months(100) },
    })
    const tds = mountTable(data).get('tbody tr').findAll('td')

    expect(tds[1]!.text()).toContain('нет завершённых месяцев')
    expect(tds[3]!.text()).toContain('месяц ещё не наступил')
  })

  it('закрепляет колонку «Категория» при горизонтальной прокрутке', () => {
    const wrapper = mountTable()

    expect(wrapper.get('[data-testid="budget-table-scroll"]').classes()).toContain(
      'overflow-x-auto',
    )
    for (const cell of wrapper.findAll('tr > :first-child')) {
      expect(cell.classes()).toEqual(expect.arrayContaining(['sticky', 'left-0']))
    }
  })

  it('прокрутка таблицы — блок позиционирования для sr-only подписей', () => {
    // sr-only — absolute: без positioned-предка подписи скрытых за прокруткой месяцев выходят
    // из overflow-обёртки и дают горизонтальный скролл всей страницы
    const scroll = mountTable().get('[data-testid="budget-table-scroll"]')

    expect(scroll.classes()).toContain('relative')
  })
})
