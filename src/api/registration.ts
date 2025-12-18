import axios from 'axios';
import type { Registration } from '@/types/registration';

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || '/auth';


export const createUser = async (data: Registration) => {
  const response = await axios.post(`${AUTH_API_URL}/registration`, data, {
  });
  return response.data;
};
