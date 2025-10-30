import axios from 'axios';
import type { Registration } from '@/types/registration';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8082';


export const createUser = async (data: Registration) => {
  const response = await axios.post(`${API_URL}/registration`, data, {
  });
  return response.data;
};
