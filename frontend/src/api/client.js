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

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/refresh")
    ) {
      originalRequest._retry = true;

      try {
        const res = await axios.post(
          `${apiBaseUrl}/auth/refresh`,
          {},
          {
            withCredentials: true,
          },
        );

        if (res.data?.access_token) {
          localStorage.setItem("access_token", res.data.access_token);

          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`;
        }

        return apiClient(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("auth_user");

        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
