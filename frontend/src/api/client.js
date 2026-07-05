import axios from "axios";

const runtimeApiBaseUrl = window.__APP_CONFIG__?.API_BASE_URL;
const buildApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const apiBaseUrl = buildApiBaseUrl || runtimeApiBaseUrl || "/api/v1";

const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

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
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshUrl = `${apiBaseUrl.replace(/\/$/, "")}/auth/refresh`;
        const res = await axios.post(refreshUrl, {}, { withCredentials: true });
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
