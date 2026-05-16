import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CheckCircle, Eye, EyeOff, Loader } from "lucide-react";
import { onboardingService } from "../services/adminUsuariosService";
import type { OnboardingTokenInfo } from "../services/adminUsuariosService";

function FieldInput({
  id, label, type = "text", value, onChange, placeholder, required = true, autoComplete,
}: {
  id: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; required?: boolean; autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} style={{ fontSize: 13, fontWeight: 500, color: "var(--color-content-primary)" }}>
        {label}
      </label>
      <input
        id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required} autoComplete={autoComplete}
        style={{
          border: "1px solid var(--color-surface-border)", borderRadius: 8,
          padding: "10px 12px", fontSize: 14, outline: "none",
          color: "var(--color-content-primary)", background: "var(--color-surface-card)",
          width: "100%", boxSizing: "border-box",
        }}
      />
    </div>
  );
}

export function OnboardingPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [info, setInfo] = useState<OnboardingTokenInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [form, setForm] = useState({ nombre: "", apellido: "", email: "", nro_documento: "", password: "", confirm: "" });
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    onboardingService.getInfo(token)
      .then(data => { setInfo(data); setForm(f => ({ ...f, email: data.email })); })
      .catch(err => setTokenError(err instanceof Error ? err.message : "Enlace inválido o expirado"))
      .finally(() => setLoadingInfo(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setError("Las contraseñas no coinciden"); return; }
    if (form.password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres"); return; }
    setSubmitting(true); setError(null);
    try {
      await onboardingService.completar(token!, {
        nombre: form.nombre, apellido: form.apellido, email: form.email,
        nro_documento: form.nro_documento, password: form.password,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al completar el registro");
    } finally {
      setSubmitting(false);
    }
  };

  const f = (k: keyof typeof form) => ({ value: form[k], onChange: (v: string) => setForm(prev => ({ ...prev, [k]: v })) });

  // ── Loading ──
  if (loadingInfo) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-surface-base)" }}>
        <Loader size={28} style={{ color: "var(--color-primary)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  // ── Token inválido ──
  if (tokenError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-surface-base)", padding: 24 }}>
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
          <img src="/numi-logo.png" alt="NUMI" style={{ height: 32, margin: "0 auto 24px" }} />
          <div style={{ background: "var(--color-surface-card)", border: "1px solid var(--color-surface-border)", borderRadius: 16, padding: 32 }}>
            <p style={{ fontSize: 15, color: "var(--color-state-absent)", fontWeight: 600, marginBottom: 8 }}>Enlace inválido</p>
            <p style={{ fontSize: 14, color: "var(--color-content-secondary)" }}>{tokenError}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Éxito ──
  if (done) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-surface-base)", padding: 24 }}>
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
          <img src="/numi-logo.png" alt="NUMI" style={{ height: 32, margin: "0 auto 24px" }} />
          <div style={{ background: "var(--color-surface-card)", border: "1px solid var(--color-surface-border)", borderRadius: 16, padding: 40 }}>
            <CheckCircle size={48} style={{ color: "var(--color-state-present)", margin: "0 auto 16px" }} />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-content-primary)", marginBottom: 8 }}>
              ¡Registro completado!
            </h1>
            <p style={{ fontSize: 14, color: "var(--color-content-secondary)", marginBottom: 24 }}>
              Tu cuenta en {info?.tenant_nombre} fue creada exitosamente. Ya podés ingresar con tu email y contraseña.
            </p>
            <button
              onClick={() => navigate("/employee/login")}
              style={{
                background: "var(--color-primary)", color: "#fff", border: "none", borderRadius: 8,
                padding: "11px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%",
              }}
            >
              Ir al login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario ──
  return (
    <div style={{ minHeight: "100vh", background: "var(--color-surface-base)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 480, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img src="/numi-logo.png" alt="NUMI" style={{ height: 32, margin: "0 auto 12px" }} />
          <p style={{ fontSize: 13, color: "var(--color-content-secondary)" }}>
            Completá tu registro en <strong style={{ color: "var(--color-content-primary)" }}>{info?.tenant_nombre}</strong>
          </p>
        </div>

        <div style={{ background: "var(--color-surface-card)", border: "1px solid var(--color-surface-border)", borderRadius: 16, padding: 32 }}>
          {error && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(220,38,38,0.08)", borderRadius: 8, border: "1px solid rgba(220,38,38,0.2)" }}>
              <p style={{ fontSize: 13, color: "var(--color-state-absent)" }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FieldInput id="nombre" label="Nombre" placeholder="Ej: Juan" autoComplete="given-name" {...f("nombre")} />
              <FieldInput id="apellido" label="Apellido" placeholder="Ej: García" autoComplete="family-name" {...f("apellido")} />
            </div>
            <FieldInput id="email" label="Email" type="email" placeholder="tu@email.com" autoComplete="email" {...f("email")} />
            <FieldInput id="nro_documento" label="Número de documento" placeholder="Ej: 30456789" {...f("nro_documento")} />

            {/* Contraseña con toggle */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label htmlFor="password" style={{ fontSize: 13, fontWeight: 500, color: "var(--color-content-primary)" }}>Contraseña</label>
              <div style={{ position: "relative" }}>
                <input
                  id="password" type={showPass ? "text" : "password"} value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Mínimo 8 caracteres" required autoComplete="new-password"
                  style={{
                    border: "1px solid var(--color-surface-border)", borderRadius: 8,
                    padding: "10px 40px 10px 12px", fontSize: 14, outline: "none",
                    color: "var(--color-content-primary)", background: "var(--color-surface-card)",
                    width: "100%", boxSizing: "border-box",
                  }}
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-content-secondary)", padding: 0 }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirmar contraseña */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label htmlFor="confirm" style={{ fontSize: 13, fontWeight: 500, color: "var(--color-content-primary)" }}>Confirmar contraseña</label>
              <input
                id="confirm" type="password" value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="Repetí tu contraseña" required autoComplete="new-password"
                style={{
                  border: "1px solid var(--color-surface-border)", borderRadius: 8,
                  padding: "10px 12px", fontSize: 14, outline: "none",
                  color: "var(--color-content-primary)", background: "var(--color-surface-card)",
                  width: "100%", boxSizing: "border-box",
                }}
              />
            </div>

            <button
              type="submit" disabled={submitting}
              style={{
                marginTop: 4, background: submitting ? "var(--color-content-secondary)" : "var(--color-primary)",
                color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px",
                fontSize: 14, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {submitting && <Loader size={16} style={{ animation: "spin 1s linear infinite" }} />}
              {submitting ? "Creando cuenta..." : "Completar registro"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
