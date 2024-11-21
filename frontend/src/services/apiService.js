const baseUrl = import.meta.env.DEV
  ? `${import.meta.env.VITE_DEV_BACKEND_URL}/api`
  : `${window.location.origin}/api`;

const fetchApi = async (endpoint, token, options = {}) => {
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    handleError(error);
  }
};

const postApi = async (endpoint, token, data, options = {}) => {
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
      ...options,
    });
    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    handleError(error);
  }
};

const handleError = (error) => {
  console.error('API Service Error:', error);
  // TODO: add toast notification etc.
};

export { fetchApi, postApi };
