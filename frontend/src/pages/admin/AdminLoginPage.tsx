import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { authService } from "../../services/authService";

const ALLOWED_ROLES = ["rrhh", "admin_empresa", "super_admin"];

export function AdminLoginPage() {
  const { refreshUser, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user && ALLOWED_ROLES.includes(user.role)) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authService.login(email, password);
      if (!ALLOWED_ROLES.includes(res.user.role)) {
        setError("Esta sección es solo para personal de RRHH.");
        return;
      }
      localStorage.setItem("access_token", res.access_token);
      localStorage.setItem("refresh_token", res.refresh_token);
      await refreshUser();
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--color-surface-app)" }}
    >
      <div
        className="w-full max-w-sm rounded-xl border p-8"
        style={{
          background: "var(--color-surface-card)",
          borderColor: "var(--color-surface-border)",
        }}
      >
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>
            HRConnect
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-content-secondary)" }}>
            Panel de RRHH
          </p>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="email"
              className="text-sm font-medium"
              style={{ color: "var(--color-content-primary)" }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors"
              style={{
                borderColor: "var(--color-surface-border)",
                color: "var(--color-content-primary)",
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="password"
              className="text-sm font-medium"
              style={{ color: "var(--color-content-primary)" }}
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors"
              style={{
                borderColor: "var(--color-surface-border)",
                color: "var(--color-content-primary)",
              }}
            />
          </div>
          <Button type="submit" loading={loading} className="mt-2 w-full">
            Ingresar
          </Button>
        </form>
      </div>
    </div>
  );
}
