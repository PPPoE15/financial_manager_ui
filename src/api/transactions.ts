import axios from 'axios';
import type { CreateTransaction } from '@/types/transaction';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2ZDhjYTAyYS01ODU0LTRlMDgtOGU4Mi00MDM0YjAyZmM0YzEiLCJsb2dpbiI6ImRhc2hhIiwiZXhwIjoxNzYxODMwNTQ2fQ.LHf745NAEXCeBS32OetE5tcZLMAVwuHcxRBBQ_L5r8E';

export const createTransaction = async (data: CreateTransaction) => {
  const response = await axios.post(`${API_URL}/transactions`, data, {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  });
  return response.data;
};
