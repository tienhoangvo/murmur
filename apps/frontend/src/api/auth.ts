import { apiClient, tokenStorage } from "./client";

export interface RegisterPayload {
  email: string;
  name: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export async function register(payload: RegisterPayload): Promise<AuthTokens> {
  const { data } = await apiClient.post<AuthTokens>("/auth/register", payload);
  tokenStorage.setAccess(data.accessToken);
  tokenStorage.setRefresh(data.refreshToken);
  return data;
}

export async function login(payload: LoginPayload): Promise<AuthTokens> {
  const { data } = await apiClient.post<AuthTokens>("/auth/login", payload);
  tokenStorage.setAccess(data.accessToken);
  tokenStorage.setRefresh(data.refreshToken);
  return data;
}

export async function logout(): Promise<void> {
  const refreshToken = tokenStorage.getRefresh();
  try {
    await apiClient.post("/auth/logout", { refreshToken });
  } finally {
    tokenStorage.clear();
  }
}

export function isAuthenticated(): boolean {
  return !!tokenStorage.getAccess();
}
