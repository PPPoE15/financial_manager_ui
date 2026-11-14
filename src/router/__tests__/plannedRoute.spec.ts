import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '../index'
describe('Маршрут планов', /** Проверяет прямую ссылку на отдельный защищённый экран. */ () => {
  it('разрешает /planned-operations внутри общего каркаса', /** Не смешивает планы с главной и фактическими операциями. */ () => {
    const router = createAppRouter(createMemoryHistory(), [])
    const route = router.resolve('/planned-operations')
    expect(route.name).toBe('planned-operations')
    expect(route.matched).toHaveLength(2)
    expect(route.meta.guestOnly).toBeUndefined()
  })
})

it('открывает вкладку и конкретную регулярную операцию по ссылке', /** Проверяет прямой вход и обновление страницы. */ () => {
  const router = createAppRouter(createMemoryHistory(), [])
  expect(router.resolve('/planned-operations/regular').name).toBe('regular-operations')
  const operation = router.resolve('/planned-operations/regular/series-1')
  expect(operation.name).toBe('regular-operation')
  expect(operation.params.operationUid).toBe('series-1')
})
