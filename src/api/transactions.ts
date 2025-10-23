import axios from 'axios';
import type { CreateTransaction } from '@/types/transaction';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const token = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjZDk3YmE2Mi1kN2I1LTRkMmItOWExNC0zNDcxOWMzYTYzNDUiLCJsb2dpbiI6ImF2aWt0b3JvdiIsImV4cCI6MTczMTQyMDQ0OH0.J5SCVHk4g_gexw8Pz08Tmc5jZfceY_Zed0qX5l8PJha_yTDndD24osoEnH1qSM8ooyJ_Pn_J0R1mOxlsWSI0kPXlTP5H1R0w3J2Z_jteZzukuwlrA76x-eMCRWbjny7XISDcSds5GhN15Qkvors_9yKOYGkMDyYZlIT1jWo1Dm9AYFqdMX34SlANeg9k2vfN_YmfiYp_7xtBf0lCjYdGnbONc_GSSfhE1oOGlYS0ufqv6DxyOElJoqq3BTekkTRzdjiDbDTRhCbHiNH_eZRWYcSxhSMBfYjHjvDtXvonpNVPhBEmBJGmxNHweneyGE68uX-Xl7BOeKKFopO1evsq-A';

export const createTransaction = async (data: CreateTransaction) => {
  const response = await axios.post(`${API_URL}/transactions`, data, {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  });
  return response.data;
};
