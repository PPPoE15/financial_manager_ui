// Колонки таблицы «Структура бюджета» по макету Figma Frame 8 (узел 116:134): «Категория» 217px
// от x=383, «План» и «Среднее» по 115px, разделитель перед январём на x=853 (после «Среднего» 23px,
// до января 24px), месяцы по 107px. «Категория» закреплена при горизонтальной прокрутке.

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

export const COLUMN_CLASS = {
  // Ниже sm закреплённая колонка уже (136px), длинные названия переносятся — иначе на 360px
  // для сумм остаётся ~60px (узкого макета нет, FM-28)
  category:
    'sticky left-0 z-10 w-[136px] min-w-[136px] whitespace-normal bg-surface-card pl-3 text-left sm:w-auto sm:min-w-[241px] sm:whitespace-nowrap sm:pl-6',
  plan: 'min-w-[115px]',
  average: 'min-w-[138px] pr-[23px]',
  january: 'min-w-[131px] border-l-[0.5px] border-ink-secondary pl-6',
  month: 'min-w-[107px]',
} as const

/** Класс колонки месяца по индексу 0–11: перед январём — вертикальный разделитель. */
export function monthColumnClass(index: number): string {
  return index === 0 ? COLUMN_CLASS.january : COLUMN_CLASS.month
}
