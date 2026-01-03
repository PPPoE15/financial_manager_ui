import axios from 'axios'
import type { CreateTransaction } from '@/types/transaction'
import { TRANSACTION_API_URL } from './constants'

export const createTransaction = async (data: CreateTransaction) => {
  const response = await axios.post(`${TRANSACTION_API_URL}/transactions`, data, {
    headers: {
      Authorization: 'Bearer ' + localStorage.getItem('authToken'),
    },
  })
  return response.data
}
