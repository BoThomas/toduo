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
    const token = await useAuthStore().getAccessTokenSilently({
      authorizationParams: {
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      },
    });
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
    const responseJson = await response.json();
    if (!responseJson.success) {
      throw new Error(`API Error: ${responseJson.message}`);
    }
    console.log('API Response:', responseJson.message); // TODO: remove
    return responseJson.data;
  } catch (error: any) {
    console.error(error.message);
    throw new Error(error.message);
  }
};

const readAPI = (endpoint: string, params?: object) => {
  // add params to the URL
  if (params && Object.keys(params).length > 0) {
    const p = new URLSearchParams(params as Record<string, string>).toString();
    endpoint = `${endpoint}?${p}`;
  }
  return apiRequest(endpoint, 'GET');
};

const createAPI = (endpoint: string, data: any, options = {}) =>
  apiRequest(endpoint, 'POST', data, options);

const updateApi = (endpoint: string, data: any, options = {}) =>
  apiRequest(endpoint, 'PUT', data, options);

const deleteApi = (endpoint: string, options = {}) =>
  apiRequest(endpoint, 'DELETE', undefined, options);

export { readAPI, createAPI, updateApi, deleteApi };
