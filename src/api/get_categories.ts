import axios, { type AxiosResponse } from 'axios';
import { TRANSACTION_API_URL } from './constants'
import type { categoryData } from '@/types/categories'
import type { TransactionType } from '@/types/transaction';

const url = `${TRANSACTION_API_URL}/categories`

/**
 * Получает список категорий по типу
 * @param category_type Тип категории (например, 'income' или 'outcome')
 * @returns Массив объектов categoryData
 */
export const getCategories = async (category_type: TransactionType): Promise<categoryData[]> => {
  const params = {
    category_type: category_type,
  }
  const response: AxiosResponse<categoryData[]> = await axios.get(url, {
    headers: {
      Authorization: 'Bearer ' + localStorage.getItem('authToken'),
    },
    params: params,
  })
  return response.data.content
}
