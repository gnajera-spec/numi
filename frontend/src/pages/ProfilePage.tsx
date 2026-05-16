import { useState, useEffect, type FormEvent } from "react";
import { User, Lock, Building, ShieldCheck, ShieldOff, Copy } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "../lib/apiClient";
import { authService } from "../services/authService";
import { Button } from "../components/Button";
import { ErrorBanner } from "../components/ErrorBanner";
import { Spinner } from "../components/Spinner";
import type { MfaSetupData } from "../types";

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

// ── MFA Section ──────────────────────────────────────────────────────────────

type MfaStep = "idle" | "setup" | "confirm" | "backup" | "disable";

function MfaSection({ mfaEnabled, onToggle }: { mfaEnabled: boolean; onToggle: () => void }) {
  const [step, setStep] = useState<MfaStep>("idle");
  const [setupData, setSetupData] = useState<MfaSetupData | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const startSetup = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authService.mfaSetup();
      setSetupData(data);
      setStep("setup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar configuración");
    } finally {
      setLoading(false);
    }
  };

  const confirmEnable = async (e: FormEvent) => {
    e.preventDefault();
    if (!setupData) return;
    setLoading(true);
    setError(null);
    try {
      await authService.mfaEnable(code, setupData.secret);
      setStep("backup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const confirmDisable = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authService.mfaDisable(code);
      setStep("idle");
      setCode("");
      onToggle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (c: string, i: number) => {
    navigator.clipboard.writeText(c);
    setCopiedIndex(i);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const finishSetup = () => {
    setStep("idle");
    setSetupData(null);
    setCode("");
    onToggle();
  };

  if (step === "idle") {
    return (
      <div className="mt-4">
        {error && <div className="mb-3"><ErrorBanner message={error} /></div>}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Verificación en dos pasos (TOTP)
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
              {mfaEnabled ? "Activa — se requiere código al iniciar sesión." : "Inactiva — recomendada para mayor seguridad."}
            </p>
          </div>
          {mfaEnabled ? (
            <Button variant="destructive" onClick={() => setStep("disable")} disabled={loading}>
              <ShieldOff size={14} /> Desactivar
            </Button>
          ) : (
            <Button onClick={startSetup} loading={loading}>
              <ShieldCheck size={14} /> Activar MFA
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (step === "setup" && setupData) {
    return (
      <div className="mt-4 flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}
        <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
          1. Escaneá este QR con Google Authenticator, Authy o cualquier app TOTP:
        </p>
        <div
          className="flex justify-center p-4 rounded-lg"
          style={{ background: "var(--color-surface-empty)" }}
        >
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(setupData.qr_uri)}`}
            alt="QR MFA"
            width={160}
            height={160}
          />
        </div>
        <p className="text-xs text-center" style={{ color: "var(--color-content-secondary)" }}>
          O ingresá el código manualmente:{" "}
          <span className="font-mono font-semibold" style={{ color: "var(--color-content-primary)" }}>
            {setupData.secret}
          </span>
        </p>
        <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
          2. Ingresá el código de 6 dígitos para confirmar:
        </p>
        <form onSubmit={confirmEnable} className="flex gap-3">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-lg border px-3 py-2.5 text-sm outline-none tracking-widest text-center flex-1"
            style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
            placeholder="000000"
          />
          <Button type="submit" loading={loading}>Confirmar</Button>
        </form>
        <Button variant="secondary" onClick={() => { setStep("idle"); setSetupData(null); setCode(""); }}>
          Cancelar
        </Button>
      </div>
    );
  }

  if (step === "backup" && setupData) {
    return (
      <div className="mt-4 flex flex-col gap-4">
        <div
          className="rounded-lg p-3"
          style={{ background: "#fef0ee", borderColor: "var(--color-state-absent)" }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-state-absent)" }}>
            Guardá estos códigos de respaldo
          </p>
          <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
            Cada código es de un solo uso. Úsalos si perdés acceso a tu app de autenticación.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {setupData.backup_codes.map((c, i) => (
            <button
              key={i}
              onClick={() => copyCode(c, i)}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-mono transition-colors hover:bg-gray-50"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
            >
              {c}
              <Copy size={12} style={{ color: copiedIndex === i ? "var(--color-state-present)" : "var(--color-content-disabled)" }} />
            </button>
          ))}
        </div>
        <Button onClick={finishSetup}>Ya los guardé — Finalizar</Button>
      </div>
    );
  }

  if (step === "disable") {
    return (
      <div className="mt-4 flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}
        <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
          Ingresá el código de tu app de autenticación para desactivar MFA:
        </p>
        <form onSubmit={confirmDisable} className="flex gap-3">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-lg border px-3 py-2.5 text-sm outline-none tracking-widest text-center flex-1"
            style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
            placeholder="000000"
          />
          <Button type="submit" variant="destructive" loading={loading}>Desactivar</Button>
        </form>
        <Button variant="secondary" onClick={() => { setStep("idle"); setCode(""); }}>
          Cancelar
        </Button>
      </div>
    );
  }

  return <div className="mt-4 flex justify-center"><Spinner /></div>;
}

// ── Página ────────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(user?.mfa_enabled ?? false);

  useEffect(() => {
    setMfaEnabled(user?.mfa_enabled ?? false);
  }, [user]);

  const handleMfaToggle = async () => {
    await refreshUser();
  };

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
          <InfoRow label="Rol" value={
            ({ colaborador: "Colaborador", rrhh: "RR.HH.", admin_empresa: "Admin empresa",
              super_admin: "Super admin", servicio_medico: "Servicio médico" } as Record<string,string>)[user?.role ?? ""] ?? user?.role
          } />
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
          <div className="flex items-center gap-2 mb-2">
            <Lock size={16} style={{ color: "var(--color-primary)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-content-primary)" }}>
              Seguridad
            </h2>
          </div>

          <div className="border-b pb-4 mb-4" style={{ borderColor: "var(--color-surface-border)" }}>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
                Contraseña
              </span>
              <button
                onClick={() => setShowPassword((v) => !v)}
                className="text-sm font-medium"
                style={{ color: "var(--color-primary)" }}
              >
                {showPassword ? "Cancelar" : "Cambiar"}
              </button>
            </div>
            {showPassword && <ChangePasswordForm />}
          </div>

          <MfaSection mfaEnabled={mfaEnabled} onToggle={handleMfaToggle} />
        </div>
      </div>
    </div>
  );
}
