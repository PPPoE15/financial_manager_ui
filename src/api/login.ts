import axios from 'axios'
import type { LoginData } from '@/types/loginData'
import { AUTH_API_URL } from './constants'

export const loginUser = async (data: LoginData) => {
  const response = await axios.post(`${AUTH_API_URL}/token`, data, {})
  localStorage.setItem('authToken', response.data.access_token)
  return response.data
}
