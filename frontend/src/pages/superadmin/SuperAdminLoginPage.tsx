import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";

export function SuperAdminLoginPage() {
  const { login, refreshUser, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user?.role === "super_admin") {
      navigate("/superadmin/tenants", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.mfa_required) {
        setError("MFA no soportado en este portal aún.");
        return;
      }
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 numi-bg">
      <div
        className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--color-surface-card)" }}
      >
        {/* Header azul con logo */}
        <div style={{ background: "var(--color-primary)", padding: "28px 32px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <img
            src="/logo.png"
            alt="NUMI"
            height={32}
            style={{ display: "block", width: "auto" }}
            draggable={false}
          />
          <span
            className="text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)" }}
          >
            Super Admin
          </span>
        </div>

        {/* Formulario */}
        <div className="px-8 py-8">

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none transition-all"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none transition-all"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
            />
          </div>
          <Button type="submit" loading={loading} className="mt-2 w-full">Ingresar</Button>
        </form>
        </div>
      </div>
    </div>
  );
}
