import { useEffect, useState } from "react";
import { Mail, Eye, EyeOff, Send } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Spinner } from "../../components/Spinner";
import { smtpConfigService, type SmtpConfigIn } from "../../services/smtpConfigService";

interface FormState {
  host: string;
  port: string;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
  activo: boolean;
  use_numi_smtp: boolean;
}

const emptyForm: FormState = {
  host: "",
  port: "587",
  username: "",
  password: "",
  from_email: "",
  from_name: "",
  use_tls: true,
  activo: true,
  use_numi_smtp: true,
};

function toServicePayload(form: FormState): SmtpConfigIn {
  return {
    host: form.host,
    port: Number(form.port) || 587,
    username: form.username,
    password: form.password,
    from_email: form.from_email,
    from_name: form.from_name,
    use_tls: form.use_tls,
    activo: form.activo,
    use_numi_smtp: form.use_numi_smtp,
  };
}

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
        {label}
      </label>
      {hint && (
        <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>{hint}</p>
      )}
      {children}
    </div>
  );
}

export function AdminSmtpConfigPage() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    smtpConfigService.get()
      .then((res) => {
        const cfg = res as unknown as { host?: string; port?: number; username?: string; from_email?: string; from_name?: string; use_tls?: boolean; activo?: boolean; use_numi_smtp?: boolean } | null;
        if (cfg) {
          setForm({
            host: cfg.host ?? "",
            port: String(cfg.port ?? 587),
            username: cfg.username ?? "",
            password: "",
            from_email: cfg.from_email ?? "",
            from_name: cfg.from_name ?? "",
            use_tls: cfg.use_tls ?? true,
            activo: cfg.activo ?? true,
            use_numi_smtp: cfg.use_numi_smtp ?? true,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (field: keyof FormState) => (value: string | boolean) =>
    setForm((c) => ({ ...c, [field]: value }));

  const inputClass =
    "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[--color-primary] transition";

  const inputStyle = {
    borderColor: "var(--color-surface-border)",
    color: "var(--color-content-primary)",
    background: "var(--color-surface-app)",
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await smtpConfigService.upsert(toServicePayload(form));
      setSuccessMsg("Configuración guardada correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await smtpConfigService.test(toServicePayload(form)) as unknown as { ok: boolean; message: string };
      if (res.ok) {
        setSuccessMsg(res.message || "Correo de prueba enviado correctamente.");
      } else {
        setError(res.message || "No se pudo conectar al servidor SMTP.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar al servidor SMTP.");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-content-primary)" }}>
            Configuración de email
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
            Servidor SMTP para el envío de notificaciones y comunicaciones a colaboradores
          </p>
        </div>

        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

        {successMsg && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium"
            style={{ background: "var(--color-state-present-bg, #f0fdf4)", color: "var(--color-state-present)" }}
          >
            <Mail size={15} />
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* Use NUMI SMTP toggle */}
          <div
            className="rounded-xl border p-5 flex flex-col gap-3 mb-4"
            style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-card)" }}
          >
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.use_numi_smtp}
                onChange={(e) => set("use_numi_smtp")(e.target.checked)}
                className="w-4 h-4 rounded"
                style={{ accentColor: "var(--color-primary)" }}
              />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
                  Usar servidor de NUMI
                </p>
                <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                  Si está activo, no necesitás configurar un servidor propio.
                </p>
              </div>
            </label>
          </div>

          {/* Custom SMTP — only shown when use_numi_smtp is off */}
          {!form.use_numi_smtp && (
            <>
              <div
                className="rounded-xl border p-5 flex flex-col gap-4"
                style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-card)" }}
              >
                <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-content-secondary)" }}>
                  Servidor SMTP
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <FieldGroup label="Host">
                      <input
                        required={!form.use_numi_smtp}
                        value={form.host}
                        onChange={(e) => set("host")(e.target.value)}
                        placeholder="smtp.gmail.com"
                        className={inputClass}
                        style={inputStyle}
                      />
                    </FieldGroup>
                  </div>
                  <FieldGroup label="Puerto">
                    <input
                      required={!form.use_numi_smtp}
                      type="number"
                      value={form.port}
                      onChange={(e) => set("port")(e.target.value)}
                      placeholder="587"
                      className={inputClass}
                      style={inputStyle}
                    />
                  </FieldGroup>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.use_tls}
                    onChange={(e) => set("use_tls")(e.target.checked)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: "var(--color-primary)" }}
                  />
                  <span className="text-sm" style={{ color: "var(--color-content-primary)" }}>
                    Usar TLS/STARTTLS
                  </span>
                </label>
              </div>

              <div
                className="rounded-xl border p-5 flex flex-col gap-4 mt-4"
                style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-card)" }}
              >
                <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-content-secondary)" }}>
                  Credenciales
                </h2>

                <FieldGroup label="Usuario">
                  <input
                    value={form.username}
                    onChange={(e) => set("username")(e.target.value)}
                    placeholder="tu@empresa.com"
                    className={inputClass}
                    style={inputStyle}
                  />
                </FieldGroup>

                <FieldGroup label="Contraseña" hint="Dejá en blanco para conservar la contraseña guardada.">
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => set("password")(e.target.value)}
                      placeholder="••••••••"
                      className={inputClass + " pr-10"}
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded"
                      style={{ color: "var(--color-content-secondary)" }}
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </FieldGroup>
              </div>
            </>
          )}

          {/* Remitente — always shown */}
          <div
            className="rounded-xl border p-5 flex flex-col gap-4 mt-4"
            style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-card)" }}
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-content-secondary)" }}>
              Remitente
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldGroup label="Nombre del remitente">
                <input
                  value={form.from_name}
                  onChange={(e) => set("from_name")(e.target.value)}
                  placeholder="NUMI"
                  className={inputClass}
                  style={inputStyle}
                />
              </FieldGroup>
              <FieldGroup label="Email del remitente">
                <input
                  type="email"
                  value={form.from_email}
                  onChange={(e) => set("from_email")(e.target.value)}
                  placeholder="noreply@empresa.com"
                  className={inputClass}
                  style={inputStyle}
                />
              </FieldGroup>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-5 flex-wrap">
            <Button type="submit" loading={saving}>
              {saving ? "Guardando…" : "Guardar configuración"}
            </Button>
            {!form.use_numi_smtp && (
              <Button
                type="button"
                variant="secondary"
                loading={testing}
                onClick={handleTest}
                className="flex items-center gap-2"
              >
                <Send size={14} />
                {testing ? "Enviando…" : "Enviar correo de prueba"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
