import axios, { type AxiosInstance, type AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/**
 * 创建 Axios 实例
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 请求拦截器
 */
apiClient.interceptors.request.use(
  (config) => {
    // 可以在这里添加认证 token 等
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

/**
 * 响应拦截器
 */
apiClient.interceptors.response.use(
  (response) => {
    // 如果响应包含 data.data，则解包
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      return { ...response, data: response.data.data };
    }
    return response;
  },
  (error: AxiosError) => {
    // 统一错误处理
    if (error.response) {
      // 服务器响应了错误状态码
      const data = error.response.data as { message?: string };
      console.error('API Error:', data.message || error.message);
    } else if (error.request) {
      // 请求发出但没有收到响应
      console.error('Network Error:', error.message);
    } else {
      // 请求配置出错
      console.error('Request Error:', error.message);
    }
    return Promise.reject(error);
  },
);

export default apiClient;

/**
 * 健康检查
 */
export async function checkHealth() {
  const response = await apiClient.get('/v1/health');
  return response.data;
}

/**
 * 数据库健康检查
 */
export async function checkDatabaseHealth() {
  const response = await apiClient.get('/v1/health/db');
  return response.data;
}

/**
 * 所有服务健康检查
 */
export async function checkAllServices() {
  const response = await apiClient.get('/v1/health/services');
  return response.data;
}
