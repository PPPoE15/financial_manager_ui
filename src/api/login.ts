import axios from 'axios';
import type { LoginData } from '@/types/loginData';

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:8080/auth';


export const loginUser = async (data: LoginData) => {
  const response = await axios.post(`${AUTH_API_URL}/token`, data, {
  });
  localStorage.setItem('authToken', response.data.access_token);
  return response.data;
};
