// Колонки таблицы «Структура бюджета» по макету Figma Frame 8 (узел 116:134): «Категория» 217px
// от x=383, «План» и «Среднее» по 115px, разделитель перед январём на x=853 (после «Среднего» 23px,
// до января 24px), месяцы по 107px. При горизонтальной прокрутке «Категория», «План» и «Среднее»
// закреплены, прокручиваются только месяцы (FM-43); ниже sm закреплена одна «Категория» — три колонки
// на 360px не оставляют места месяцам.

export const MONTH_NAMES = [
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
] as const

// Ширины закреплённых колонок фиксированные: отступ `left` следующей — сумма ширин предыдущих
// (241 = 217 + 24 отступа слева, 356 = 241 + 115). Длинное название статьи переносится, а не расширяет колонку.
// z-index закреплённых ячеек задаёт строка (`PINNED_Z`): у итоговой он выше, чем у статей под ней.
export const COLUMN_CLASS = {
  category:
    'sticky left-0 w-[136px] min-w-[136px] whitespace-normal bg-surface-card pl-3 text-left [overflow-wrap:anywhere] sm:w-[241px] sm:min-w-[241px] sm:pl-6',
  plan: 'w-[115px] min-w-[115px] bg-surface-card sm:sticky sm:left-[241px]',
  // Разделитель перед месяцами — у закреплённого «Среднего», иначе он уезжал бы с январём
  average:
    'w-[138px] min-w-[138px] border-r-[0.5px] border-ink-secondary bg-surface-card pr-[23px] sm:sticky sm:left-[356px]',
  january: 'min-w-[131px] pl-6',
  month: 'min-w-[107px]',
} as const

/** z-index закреплённых по горизонтали колонок в шапке и строках статей («План» и «Среднее» — с sm). */
export const PINNED_Z = { category: 'z-10', plan: 'sm:z-10', average: 'sm:z-10' } as const

/**
 * Ячейки итоговой строки прилипают к низу прокрутки; её закреплённые слева ячейки — над всеми,
 * месяцы — над строками статей.
 */
export const TOTAL_CLASS = {
  pinned: 'sticky bottom-0 z-20',
  month: 'sticky bottom-0 z-10 bg-surface-card',
} as const

/** Класс колонки месяца по индексу 0–11: перед январём — вертикальный разделитель. */
export function monthColumnClass(index: number): string {
  return index === 0 ? COLUMN_CLASS.january : COLUMN_CLASS.month
}
