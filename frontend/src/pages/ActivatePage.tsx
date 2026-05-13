import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { authService } from "../services/authService";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/Button";
import { ErrorBanner } from "../components/ErrorBanner";

export function ActivatePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [cuil, setCuil] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await authService.activate(token, firstName, cuil, password);
      localStorage.setItem("access_token", res.access_token ?? "");
      localStorage.setItem("refresh_token", res.refresh_token ?? "");
      await refreshUser();
      navigate("/employee/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al activar la cuenta");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: "var(--color-surface-app)" }}
      >
        <div
          className="w-full max-w-sm rounded-xl border p-8 text-center"
          style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
        >
          <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
            Link de activación inválido o vencido. Pedile a RR.HH. que te reenvíe la invitación.
          </p>
          <Link
            to="/employee/login"
            className="mt-4 inline-block text-sm font-medium"
            style={{ color: "var(--color-primary)" }}
          >
            Ir al login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--color-surface-app)" }}
    >
      <div
        className="w-full max-w-sm rounded-xl border p-8"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>
            Activar cuenta
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-content-secondary)" }}>
            Confirmá tu identidad y creá tu contraseña
          </p>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="firstName" className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Nombre (como está en el sistema)
            </label>
            <input
              id="firstName"
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="cuil" className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              CUIL (sin guiones)
            </label>
            <input
              id="cuil"
              type="text"
              required
              maxLength={11}
              pattern="\d{11}"
              value={cuil}
              onChange={(e) => setCuil(e.target.value)}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none"
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
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="confirm" className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Confirmar contraseña
            </label>
            <input
              id="confirm"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
            />
          </div>
          <Button type="submit" loading={loading} className="mt-2 w-full">
            Activar cuenta
          </Button>
        </form>
      </div>
    </div>
  );
}
