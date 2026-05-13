import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { authService } from "../services/authService";
import type { UserMe } from "../types";

interface AuthState {
  user: UserMe | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface MfaRequired {
  mfa_required: true;
  mfa_token: string;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<MfaRequired | { mfa_required: false }>;
  loginMfaChallenge: (mfa_token: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setState({ user: null, isLoading: false, isAuthenticated: false });
      return;
    }
    try {
      const user = await authService.me();
      setState({ user, isLoading: false, isAuthenticated: true });
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const _applyTokens = (res: { access_token?: string; refresh_token?: string; user?: import("../types").UserMe }) => {
    localStorage.setItem("access_token", res.access_token ?? "");
    localStorage.setItem("refresh_token", res.refresh_token ?? "");
    setState({ user: res.user ?? null, isLoading: false, isAuthenticated: true });
  };

  const login = async (email: string, password: string) => {
    const res = await authService.login(email, password);
    if (res.mfa_required && res.mfa_token) {
      return { mfa_required: true as const, mfa_token: res.mfa_token };
    }
    _applyTokens(res);
    return { mfa_required: false as const };
  };

  const loginMfaChallenge = async (mfa_token: string, code: string) => {
    const res = await authService.mfaChallenge(mfa_token, code);
    _applyTokens(res);
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem("refresh_token") ?? "";
    try {
      await authService.logout(refreshToken);
    } catch {
      // best-effort
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setState({ user: null, isLoading: false, isAuthenticated: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, loginMfaChallenge, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
