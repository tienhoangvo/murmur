import axios, { type InternalAxiosRequestConfig } from "axios";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Token storage ─────────────────────────────────────────────────────────────

const TOKEN_KEY = "murmur_access_token";
const REFRESH_KEY = "murmur_refresh_token";

export const tokenStorage = {
  getAccess: () => localStorage.getItem(TOKEN_KEY),
  setAccess: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  setRefresh: (token: string) => localStorage.setItem(REFRESH_KEY, token),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// ── Request interceptor — attach access token ─────────────────────────────────

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccess();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

// ── Response interceptor — refresh on 401 ────────────────────────────────────

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      // queue this request until refresh completes
      return new Promise((resolve) => {
        refreshQueue.push((token) => {
          original.headers.set("Authorization", `Bearer ${token}`);
          resolve(apiClient(original));
        });
      });
    }

    isRefreshing = true;

    try {
      const refreshToken = tokenStorage.getRefresh();
      if (!refreshToken) throw new Error("No refresh token");

      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
        refreshToken,
      });

      tokenStorage.setAccess(data.accessToken);
      tokenStorage.setRefresh(data.refreshToken);

      // flush queued requests
      refreshQueue.forEach((cb) => cb(data.accessToken));
      refreshQueue = [];

      original.headers.set("Authorization", `Bearer ${data.accessToken}`);
      return apiClient(original);
    } catch {
      tokenStorage.clear();
      window.location.href = "/login";
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);
