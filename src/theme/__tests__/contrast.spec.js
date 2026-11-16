import { describe, expect, it } from 'vitest'
import config from '../../../tailwind.config.js'

const colors = config.theme.extend.colors
function luminance(hex) {
  const channels = hex
    .replace('#', '')
    .match(/../g)
    .map((part) => {
      const value = parseInt(part, 16) / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

describe('Контраст базовых элементов темы', () => {
  it('текст и подсказки читаемы на поверхности и внутри полей', () => {
    for (const surface of [colors.surface.DEFAULT, colors.surface.card]) {
      for (const text of [colors.ink.DEFAULT, colors.ink.secondary, colors.ink.placeholder]) {
        expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
  it('сообщение об ошибке читаемо на обеих поверхностях', () => {
    for (const surface of [colors.surface.DEFAULT, colors.surface.card]) {
      expect(contrast(colors.danger, surface)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

it('переходная палитра сохраняет контраст меню и кнопки выхода', () => {
  expect(contrast(colors.sidebar.text, colors.primary.DEFAULT)).toBeGreaterThanOrEqual(4.5)
  expect(contrast(colors.sidebar.accent, colors.primary.dark)).toBeGreaterThanOrEqual(4.5)
})

it('надпись основной кнопки читаема во всех доступных состояниях', () => {
  for (const background of [colors.action.DEFAULT, colors.action.hover, colors.action.pressed]) {
    expect(contrast(colors.action.foreground, background)).toBeGreaterThanOrEqual(4.5)
  }
})
