import { useState } from "react";
import { Mail, Eye, EyeOff, Send, Check, Sparkles, Settings2 } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";

type EmailMode = "numi" | "custom";

interface SmtpConfig {
  host: string;
  port: string;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
}

const emptyConfig: SmtpConfig = {
  host: "",
  port: "587",
  username: "",
  password: "",
  from_email: "",
  from_name: "",
  use_tls: true,
};

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
        {label}
      </label>
      {hint && (
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>{hint}</p>
      )}
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  padding: "8px 12px",
  fontSize: 13,
  color: "var(--color-text-primary)",
  background: "var(--color-bg-app)",
  outline: "none",
  boxSizing: "border-box",
};

interface ModeCardProps {
  selected: boolean;
  onClick: () => void;
  icon: React.ElementType;
  iconColor: string;
  title: string;
  description: string;
}

function ModeCard({ selected, onClick, icon: Icon, iconColor, title, description }: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "16px 18px",
        borderRadius: 12,
        border: `2px solid ${selected ? "var(--color-primary)" : "var(--color-border)"}`,
        background: selected ? "var(--color-primary-xlight)" : "var(--color-bg-card)",
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color 150ms ease, background 150ms ease",
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: selected ? iconColor : "var(--color-bg-subtle)",
        transition: "background 150ms ease",
      }}>
        <Icon size={18} style={{ color: selected ? "#fff" : "var(--color-text-secondary)" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: selected ? "var(--color-primary)" : "var(--color-text-primary)",
          }}>
            {title}
          </span>
          {selected && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
              background: "var(--color-primary)", color: "#fff",
            }}>
              <Check size={9} /> Activo
            </span>
          )}
        </div>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.4 }}>
          {description}
        </p>
      </div>
    </button>
  );
}

export function AdminSmtpConfigPage() {
  const [mode, setMode] = useState<EmailMode>("numi");
  const [config, setConfig] = useState<SmtpConfig>(emptyConfig);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const set = (field: keyof SmtpConfig) => (value: string | boolean) =>
    setConfig((c) => ({ ...c, [field]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await new Promise((r) => setTimeout(r, 800));
      setSuccessMsg(
        mode === "numi"
          ? "Configuración guardada. Se usará el servidor de Numi para el envío."
          : "Configuración SMTP guardada correctamente."
      );
    } catch {
      setError("No se pudo guardar la configuración. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      setSuccessMsg("Correo de prueba enviado correctamente.");
    } catch {
      setError("No se pudo conectar al servidor SMTP. Revisá los datos.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <AdminLayout>
      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 640 }}>

        {/* Header */}
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)" }}>
            Configuración de email
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
            Elegí cómo se enviarán las notificaciones y comunicaciones a los colaboradores
          </p>
        </div>

        {/* Feedback */}
        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
        {successMsg && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 500,
            background: "#f0fdf4", color: "var(--color-state-present, #16a34a)",
          }}>
            <Mail size={15} />
            {successMsg}
          </div>
        )}

        {/* Selector de modo */}
        <div style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: 14, padding: 20,
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", color: "var(--color-text-disabled)" }}>
            Origen del envío
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <ModeCard
              selected={mode === "numi"}
              onClick={() => setMode("numi")}
              icon={Sparkles}
              iconColor="#4BA3D9"
              title="Usar servidor de Numi"
              description="Numi gestiona el envío. Sin configuración adicional, listo para usar."
            />
            <ModeCard
              selected={mode === "custom"}
              onClick={() => setMode("custom")}
              icon={Settings2}
              iconColor="#75559b"
              title="Servidor propio (SMTP)"
              description="Configurá tu propio servidor SMTP para enviar desde tu dominio."
            />
          </div>
        </div>

        {/* Info modo Numi */}
        {mode === "numi" && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 12,
            padding: "14px 16px", borderRadius: 12,
            background: "var(--color-primary-xlight)",
            border: "1px solid var(--color-primary-light, #bfdbfe)",
          }}>
            <Sparkles size={16} style={{ color: "var(--color-primary)", flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>
                Servidor de Numi activo
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                Los correos se enviarán desde <strong>notificaciones@numi.app</strong> en nombre de tu organización.
                No requiere ninguna configuración adicional.
              </p>
            </div>
          </div>
        )}

        {/* Formulario SMTP personalizado */}
        {mode === "custom" && (
          <>
            {/* Servidor */}
            <div style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 14, padding: 20,
              display: "flex", flexDirection: "column", gap: 16,
            }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", color: "var(--color-text-disabled)" }}>
                Servidor SMTP
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div style={{ gridColumn: "span 2" }}>
                  <FieldGroup label="Host">
                    <input
                      required={mode === "custom"}
                      value={config.host}
                      onChange={(e) => set("host")(e.target.value)}
                      placeholder="smtp.gmail.com"
                      style={inputStyle}
                    />
                  </FieldGroup>
                </div>
                <FieldGroup label="Puerto">
                  <input
                    required={mode === "custom"}
                    type="number"
                    value={config.port}
                    onChange={(e) => set("port")(e.target.value)}
                    placeholder="587"
                    style={inputStyle}
                  />
                </FieldGroup>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={config.use_tls}
                  onChange={(e) => set("use_tls")(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--color-primary)" }}
                />
                <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>Usar TLS/STARTTLS</span>
              </label>
            </div>

            {/* Credenciales */}
            <div style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 14, padding: 20,
              display: "flex", flexDirection: "column", gap: 16,
            }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", color: "var(--color-text-disabled)" }}>
                Credenciales
              </p>
              <FieldGroup label="Usuario">
                <input
                  value={config.username}
                  onChange={(e) => set("username")(e.target.value)}
                  placeholder="tu@empresa.com"
                  style={inputStyle}
                />
              </FieldGroup>
              <FieldGroup label="Contraseña">
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={config.password}
                    onChange={(e) => set("password")(e.target.value)}
                    placeholder="••••••••"
                    style={{ ...inputStyle, paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={{
                      position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", padding: 4,
                      color: "var(--color-text-secondary)",
                    }}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </FieldGroup>
            </div>

            {/* Remitente */}
            <div style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 14, padding: 20,
              display: "flex", flexDirection: "column", gap: 16,
            }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", color: "var(--color-text-disabled)" }}>
                Remitente
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FieldGroup label="Nombre del remitente">
                  <input
                    value={config.from_name}
                    onChange={(e) => set("from_name")(e.target.value)}
                    placeholder="Mi Empresa"
                    style={inputStyle}
                  />
                </FieldGroup>
                <FieldGroup label="Email del remitente">
                  <input
                    type="email"
                    value={config.from_email}
                    onChange={(e) => set("from_email")(e.target.value)}
                    placeholder="noreply@empresa.com"
                    style={inputStyle}
                  />
                </FieldGroup>
              </div>
            </div>
          </>
        )}

        {/* Acciones */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : "Guardar configuración"}
          </Button>
          {mode === "custom" && (
            <Button
              type="button"
              variant="secondary"
              disabled={testing}
              onClick={handleTest}
            >
              <Send size={14} style={{ marginRight: 6 }} />
              {testing ? "Enviando…" : "Enviar correo de prueba"}
            </Button>
          )}
        </div>
      </form>
    </AdminLayout>
  );
}
