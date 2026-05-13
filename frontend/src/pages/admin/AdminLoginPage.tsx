import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";

const ALLOWED_ROLES = ["rrhh", "admin_empresa", "super_admin"];

export function AdminLoginPage() {
  const { login, loginMfaChallenge, refreshUser, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // MFA challenge step
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");

  useEffect(() => {
    if (isAuthenticated && user && ALLOWED_ROLES.includes(user.role)) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.mfa_required) {
        setMfaToken(result.mfa_token);
        return;
      }
      // Verify role after login
      await refreshUser();
      // refreshUser updates state; useEffect handles redirect
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleMfaChallenge = async (e: FormEvent) => {
    e.preventDefault();
    if (!mfaToken) return;
    setError(null);
    setLoading(true);
    try {
      await loginMfaChallenge(mfaToken, totpCode);
      await refreshUser();
      // useEffect handles redirect after user state updates
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido");
      setTotpCode("");
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
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        {!mfaToken ? (
          <>
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>
                HRConnect
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--color-content-secondary)" }}>
                Panel de RRHH
              </p>
            </div>

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
                  className="rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors"
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
                  className="rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors"
                  style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
                />
              </div>
              <Button type="submit" loading={loading} className="mt-2 w-full">
                Ingresar
              </Button>
            </form>
          </>
        ) : (
          <>
            <div className="mb-6 text-center">
              <ShieldCheck size={40} className="mx-auto mb-3" style={{ color: "var(--color-primary)" }} />
              <h2 className="text-lg font-bold" style={{ color: "var(--color-content-primary)" }}>
                Verificación en dos pasos
              </h2>
              <p className="text-sm mt-1" style={{ color: "var(--color-content-secondary)" }}>
                Ingresá el código de tu app de autenticación
              </p>
            </div>

            {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

            <form onSubmit={handleMfaChallenge} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="totp" className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
                  Código de 6 dígitos
                </label>
                <input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={8}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\s/g, ""))}
                  className="rounded-lg border px-3 py-2.5 text-sm outline-none tracking-widest text-center"
                  style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
                  placeholder="000000"
                  autoFocus
                />
              </div>
              <Button type="submit" loading={loading} className="w-full">
                Verificar
              </Button>
            </form>

            <button
              onClick={() => { setMfaToken(null); setError(null); setTotpCode(""); }}
              className="mt-4 flex items-center gap-1 mx-auto text-xs"
              style={{ color: "var(--color-content-secondary)" }}
            >
              <ArrowLeft size={13} /> Volver al login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
