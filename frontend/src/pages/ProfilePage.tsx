import { useState, type FormEvent } from "react";
import { User, Lock, Building } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "../lib/apiClient";
import { Button } from "../components/Button";
import { ErrorBanner } from "../components/ErrorBanner";

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between py-3 border-b last:border-b-0" style={{ borderColor: "var(--color-surface-border)" }}>
      <span className="text-sm" style={{ color: "var(--color-content-secondary)" }}>{label}</span>
      <span className="text-sm font-medium text-right" style={{ color: "var(--color-content-primary)" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) { setError("Las contraseñas no coinciden"); return; }
    if (next.length < 8) { setError("La contraseña debe tener mínimo 8 caracteres"); return; }
    setError(null);
    setLoading(true);
    try {
      await apiClient.post("/auth/change-password", {
        current_password: current,
        new_password: next,
      });
      setSuccess(true);
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cambiar contraseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
      {error && <ErrorBanner message={error} />}
      {success && (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{ background: "#f0fdf4", borderColor: "var(--color-state-present)", color: "var(--color-state-present)" }}
        >
          Contraseña actualizada correctamente.
        </div>
      )}
      {[
        { id: "current", label: "Contraseña actual", value: current, set: setCurrent, complete: "current-password" },
        { id: "next", label: "Nueva contraseña", value: next, set: setNext, complete: "new-password" },
        { id: "confirm", label: "Confirmar nueva contraseña", value: confirm, set: setConfirm, complete: "new-password" },
      ].map(({ id, label, value, set, complete }) => (
        <div key={id} className="flex flex-col gap-1">
          <label htmlFor={id} className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
            {label}
          </label>
          <input
            id={id}
            type="password"
            autoComplete={complete}
            required
            minLength={id === "current" ? 1 : 8}
            value={value}
            onChange={(e) => set(e.target.value)}
            className="rounded-lg border px-3 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
          />
        </div>
      ))}
      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          Actualizar contraseña
        </Button>
      </div>
    </form>
  );
}

export function ProfilePage() {
  const { user } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <User size={22} style={{ color: "var(--color-primary)" }} />
        <h1 className="text-[22px] font-bold" style={{ color: "var(--color-content-primary)" }}>
          Mi perfil
        </h1>
      </div>

      <div className="flex flex-col gap-4">
        {/* Datos personales */}
        <div
          className="rounded-xl border p-5"
          style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <User size={16} style={{ color: "var(--color-primary)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-content-primary)" }}>
              Datos personales
            </h2>
            <span
              className="text-xs rounded-full px-2 py-0.5"
              style={{ background: "var(--color-surface-empty)", color: "var(--color-content-secondary)" }}
            >
              Solo lectura
            </span>
          </div>
          <InfoRow label="Nombre" value={user?.full_name} />
          <InfoRow label="Email" value={user?.email} />
          <InfoRow label="Rol" value={user?.role} />
        </div>

        {/* Empresa */}
        <div
          className="rounded-xl border p-5"
          style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Building size={16} style={{ color: "var(--color-primary)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-content-primary)" }}>
              Empresa
            </h2>
            <span
              className="text-xs rounded-full px-2 py-0.5"
              style={{ background: "var(--color-surface-empty)", color: "var(--color-content-secondary)" }}
            >
              Solo lectura
            </span>
          </div>
          <InfoRow label="Empresa" value={user?.tenant_nombre} />
          <InfoRow label="Puesto" value={user?.puesto_nombre} />
          <InfoRow label="Departamento" value={user?.departamento_nombre} />
          <InfoRow label="Sede" value={user?.sede_nombre} />
        </div>

        {/* Seguridad */}
        <div
          className="rounded-xl border p-5"
          style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Lock size={16} style={{ color: "var(--color-primary)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--color-content-primary)" }}>
                Seguridad
              </h2>
            </div>
            <button
              onClick={() => setShowPassword((v) => !v)}
              className="text-sm font-medium"
              style={{ color: "var(--color-primary)" }}
            >
              {showPassword ? "Cancelar" : "Cambiar contraseña"}
            </button>
          </div>
          {showPassword && <ChangePasswordForm />}
        </div>
      </div>
    </div>
  );
}
