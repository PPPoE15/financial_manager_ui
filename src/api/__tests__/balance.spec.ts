import { describe, expect, it, vi } from 'vitest'

import { createStartingBalance, getStartingBalance } from '@/api/balance'
import { http } from '@/api/client'

const balance = { amount: -120000, balance_date: '2026-10-11' }

describe('API стартового остатка', () => {
  it('getStartingBalance отправляет GET /starting-balance в API транзакций', async () => {
    const get = vi.spyOn(http, 'get').mockResolvedValue({ data: balance })

    await expect(getStartingBalance()).resolves.toEqual(balance)

    expect(get).toHaveBeenCalledWith('/starting-balance')
  })

  it('createStartingBalance отправляет POST /starting-balance только с суммой', async () => {
    const post = vi.spyOn(http, 'post').mockResolvedValue({ data: balance })

    await expect(createStartingBalance({ amount: -120000 })).resolves.toEqual(balance)

    expect(post).toHaveBeenCalledWith('/starting-balance', { amount: -120000 })
  })
})
