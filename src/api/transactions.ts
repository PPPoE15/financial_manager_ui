import axios from 'axios';
import type { CreateTransaction } from '@/types/transaction';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const createTransaction = async (data: CreateTransaction) => {
  const response = await axios.post(`${API_URL}/transactions`, data);
  return response.data;
};
