import axios from "axios";
import { useLoadingStore } from "../store/loadingStore";

const runtimeApiBaseUrl = window.__APP_CONFIG__?.API_BASE_URL;
const buildApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const configuredApiBaseUrl =
  runtimeApiBaseUrl && runtimeApiBaseUrl !== "/api/v1" ? runtimeApiBaseUrl : buildApiBaseUrl;
const apiBaseUrl = (configuredApiBaseUrl || "/api/v1").replace(/\/$/, "");

const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  useLoadingStore.getState().beginRequest();
  config.__usesGlobalLoader = true;
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  useLoadingStore.getState().endRequest();
  return Promise.reject(error);
});

apiClient.interceptors.response.use(
  (response) => {
    if (response.config?.__usesGlobalLoader) {
      useLoadingStore.getState().endRequest();
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (originalRequest?.__usesGlobalLoader) {
      useLoadingStore.getState().endRequest();
      originalRequest.__usesGlobalLoader = false;
    }
    const requestUrl = originalRequest?.url || "";
    const isAuthRequest =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/refresh");

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthRequest
    ) {
      originalRequest._retry = true;
      try {
        const res = await axios.post(`${apiBaseUrl}/auth/refresh`, {}, { withCredentials: true });
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
