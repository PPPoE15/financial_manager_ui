import axios from 'axios'
import type { Registration } from '@/types/registration'
import { AUTH_API_URL } from './constants'

export const createUser = async (data: Registration) => {
  const response = await axios.post(`${AUTH_API_URL}/registration`, data, {})
  return response.data
}
