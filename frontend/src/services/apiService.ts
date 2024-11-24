import { useAuthStore } from '@/stores/auth';

const baseUrl = import.meta.env.DEV
  ? `${import.meta.env.VITE_DEV_BACKEND_URL}/api`
  : `${window.location.origin}/api`;

const apiRequest = async (
  endpoint: string,
  method: string,
  data?: any,
  options: { headers?: Record<string, string> } = {},
) => {
  try {
    const token = await useAuthStore().getAccessTokenSilently();
    console.log(token);
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }
    const responseData = await response.json();
    if (!responseData.success) {
      throw new Error(`API Error: ${responseData.message}`);
    }
    return responseData.message;
  } catch (error) {
    handleError(error);
  }
};

const readAPI = (endpoint: string, options = {}) =>
  apiRequest(endpoint, 'GET', undefined, options);

const createAPI = (endpoint: string, data: any, options = {}) =>
  apiRequest(endpoint, 'POST', data, options);

const updateApi = (endpoint: string, data: any, options = {}) =>
  apiRequest(endpoint, 'PUT', data, options);

const deleteApi = (endpoint: string, options = {}) =>
  apiRequest(endpoint, 'DELETE', undefined, options);

const handleError = (error: unknown) => {
  console.error('API Service Error:', error);
  // TODO: add toast notification etc.
};

export { readAPI, createAPI, updateApi, deleteApi };
