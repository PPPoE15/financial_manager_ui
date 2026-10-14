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

  it('выводит строку на каждую статью и итоговую строку «Сумма»', () => {
    const wrapper = mountTable()
    const bodyRows = wrapper.findAll('tbody tr')
    const footRows = wrapper.findAll('tfoot tr')

    expect(bodyRows.map((row) => row.get('th').text())).toEqual(['еда вне дома', 'подарки'])
    expect(footRows).toHaveLength(1)
    expect(cells(footRows[0]!).slice(0, 6)).toEqual([
      'Сумма',
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

  it('итоговую строку «Сумма» выделяет жирным — и название, и суммы', () => {
    // Жирность задаёт строка, ячейки её наследуют — у них не должно быть своего начертания
    const wrapper = mountTable()
    const total = wrapper.get('tfoot tr')

    expect(total.classes()).toContain('font-bold')
    for (const cell of total.findAll('th, td')) {
      expect(cell.classes().filter((name) => /^font-(?!brand|sans)/.test(name))).toEqual([])
    }
    for (const row of wrapper.findAll('tbody tr')) {
      expect(row.classes()).not.toContain('font-bold')
    }
  })

  it('закрепляет колонку «Категория» при горизонтальной прокрутке', () => {
    const wrapper = mountTable()

    expect(wrapper.get('[data-testid="budget-table-scroll"]').classes()).toContain('overflow-auto')
    for (const cell of wrapper.findAll('tr > :first-child')) {
      expect(cell.classes()).toEqual(expect.arrayContaining(['sticky', 'left-0']))
    }
  })

  it('закрепляет и «План» со «Средним», когда месяцам хватает места: 768–1023px и от 1140px', () => {
    // Ширина карточки: до lg — экран минус поля, с lg — ещё минус боковое меню (278px). На 640–767px и
    // 1024–1139px три закреплённые колонки (453px) оставили бы месяцам меньше двух колонок.
    // Отступы слева — сумма ширин колонок перед ячейкой, поэтому ширина «Категории» фиксированная
    const pinnedAt = (left: string) => [
      'md:max-lg:sticky',
      'min-[1140px]:sticky',
      `md:max-lg:left-[${left}]`,
      `min-[1140px]:left-[${left}]`,
    ]
    for (const row of mountTable().findAll('tr')) {
      const [category, plan, average] = row.findAll('th, td')
      expect(category!.classes()).toEqual(
        expect.arrayContaining(['sm:w-[200px]', 'sm:min-w-[200px]']),
      )
      expect(plan!.classes()).toEqual(
        expect.arrayContaining([...pinnedAt('200px'), 'w-[115px]', 'bg-surface-card']),
      )
      expect(average!.classes()).toEqual(
        expect.arrayContaining([...pinnedAt('315px'), 'w-[138px]', 'bg-surface-card']),
      )
      for (const cell of [plan!, average!]) {
        expect(cell.classes().filter((name) => name.startsWith('sm:'))).toEqual([])
      }
    }
  })

  it('название длиннее 20 символов обрезает с многоточием, полное — в подсказке и для скринридера', () => {
    const data = budgetStructure()
    data.rows[0]!.category.name = 'очень длинное название статьи'
    const name = mountTable(data).get('tbody th')

    expect(name.get('[aria-hidden="true"]').text()).toBe('очень длинное назван…')
    expect(name.get('.sr-only').text()).toBe('очень длинное название статьи')
    expect(name.attributes('title')).toBeUndefined()
    expect(name.get('[title]').attributes('title')).toBe('очень длинное название статьи')
  })

  it('название из 20 символов и короче выводит целиком, с подсказкой на случай обрезки по ширине', () => {
    // 20 широких букв («ЖИЛИЩНО-КОММУНАЛЬНЫЕ») шире колонки — их обрезает CSS, подсказка нужна и им
    const data = budgetStructure()
    data.rows[0]!.category.name = 'продукты и хозтовары'
    const name = mountTable(data).get('tbody th')

    expect(name.text()).toBe('продукты и хозтовары')
    expect(name.attributes('title')).toBeUndefined()
    expect(name.get('[title]').attributes('title')).toBe('продукты и хозтовары')
    expect(name.find('[aria-hidden="true"]').exists()).toBe(false)
  })

  it('у строки «Сумма» подсказки нет', () => {
    expect(mountTable().get('tfoot th').find('[title]').exists()).toBe(false)
  })

  it('разделитель перед месяцами — у закреплённого «Среднего», а не у прокручиваемого января', () => {
    const row = mountTable().get('tbody tr')
    const [, , average, january] = row.findAll('th, td')

    expect(average!.classes()).toContain('border-r-[0.5px]')
    expect(january!.classes().some((name) => name.startsWith('border-l'))).toBe(false)
  })

  it('«Сумма» прилипает к низу таблицы при вертикальной прокрутке', () => {
    const cellsOfTotal = mountTable().findAll('tfoot th, tfoot td')

    expect(cellsOfTotal).toHaveLength(15)
    for (const cell of cellsOfTotal) {
      expect(cell.classes()).toEqual(
        expect.arrayContaining(['sticky', 'bottom-0', 'bg-surface-card']),
      )
    }
  })

  it('закреплённая «Сумма» лежит над «Планом» и «Средним» итога, которые уезжают под неё на узком экране', () => {
    // z-index без префикса ширины: ниже sm «План» и «Среднее» итога прокручиваются влево под «Сумму»
    const zIndex = (cell: DOMWrapper<Element>) =>
      Number(
        cell
          .classes()
          .find((name) => /^z-\d+$/.test(name))
          ?.slice(2) ?? 0,
      )
    const [total, plan, average, january] = mountTable().findAll('tfoot th, tfoot td')

    expect(zIndex(total!)).toBeGreaterThan(zIndex(plan!))
    expect(zIndex(total!)).toBeGreaterThan(zIndex(average!))
    expect(zIndex(plan!)).toBeGreaterThan(zIndex(january!))
    expect(zIndex(january!)).toBeGreaterThan(0)
  })

  it('по высоте не меньше половины таблицы макета (250px) и не больше макета (500px)', () => {
    const scroll = mountTable().get('[data-testid="budget-table-scroll"]')

    expect(scroll.classes()).toEqual(expect.arrayContaining(['min-h-[250px]', 'max-h-[500px]']))
  })

  it('прокрутка таблицы — блок позиционирования для sr-only подписей', () => {
    // sr-only — absolute: без positioned-предка подписи скрытых за прокруткой месяцев выходят
    // из overflow-обёртки и дают горизонтальный скролл всей страницы
    const scroll = mountTable().get('[data-testid="budget-table-scroll"]')

    expect(scroll.classes()).toContain('relative')
  })
})
