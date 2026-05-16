import { apiClient } from "../lib/apiClient";
import type { LoginResponse, UserMe, MfaSetupData } from "../types";

export const authService = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse>("/auth/login", { email, password }),

  mfaChallenge: (mfa_token: string, code: string) =>
    apiClient.post<LoginResponse>("/auth/mfa/challenge", { mfa_token, code }),

  mfaSetup: () => apiClient.get<MfaSetupData>("/auth/mfa/setup"),

  mfaEnable: (code: string, secret: string) =>
    apiClient.post<{ mfa_enabled: boolean }>("/auth/mfa/enable", { code, secret }),

  mfaDisable: (code: string) =>
    apiClient.post<{ mfa_enabled: boolean }>("/auth/mfa/disable", { code }),

  activate: (token: string, first_name: string, cuil: string, password: string) =>
    apiClient.post<LoginResponse>("/auth/activate", { token, first_name, cuil, password }),

  refresh: (refresh_token: string) =>
    apiClient.post<{ access_token: string; token_type: string }>("/auth/refresh", {
      refresh_token,
    }),

  logout: (refresh_token: string) =>
    apiClient.post<void>("/auth/logout", { refresh_token }),

  me: () => apiClient.get<UserMe>("/auth/me"),

  switchRole: (role: string) =>
    apiClient.post<{ access_token: string; refresh_token: string; token_type: string }>(
      "/auth/switch-role", { role }
    ),
};
