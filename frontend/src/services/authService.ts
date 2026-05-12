import { apiClient } from "../lib/apiClient";
import type { LoginResponse, UserMe } from "../types";

export const authService = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse>("/auth/login", { email, password }),

  activate: (token: string, first_name: string, cuil: string, password: string) =>
    apiClient.post<LoginResponse>("/auth/activate", { token, first_name, cuil, password }),

  refresh: (refresh_token: string) =>
    apiClient.post<{ access_token: string; token_type: string }>("/auth/refresh", {
      refresh_token,
    }),

  logout: (refresh_token: string) =>
    apiClient.post<void>("/auth/logout", { refresh_token }),

  me: () => apiClient.get<UserMe>("/auth/me"),
};
