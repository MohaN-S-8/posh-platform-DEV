import axios from "axios";

const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}/api/v1`,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshPromise = null;

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post(
              `${import.meta.env.VITE_API_BASE_URL}/api/v1/auth/refresh`,
              {},
              { withCredentials: true },
            )
            .finally(() => {
              refreshPromise = null;
            });
        }
        const res = await refreshPromise;

        if (res.data?.access_token) {
          localStorage.setItem("access_token", res.data.access_token);
          originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`;
        }
        return apiClient(originalRequest);
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("auth_user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
