import axios from 'axios'
import { TRANSACTION_API_URL } from './constants'

const url = `${TRANSACTION_API_URL}/transactions`

export const getTransactions = async (transaction_type: string) => {
  const params = {
    transaction_type: transaction_type,
  }
  const response = await axios.get(url, {
    headers: {
      Authorization: 'Bearer ' + localStorage.getItem('authToken'),
    },
    params: params,
  })
  return response.data
}
