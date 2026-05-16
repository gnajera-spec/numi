import { useEffect, useState } from "react";
import { Mail, CheckCircle, XCircle, Loader, Eye, EyeOff } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { smtpConfigService } from "../../services/smtpConfigService";
import type { SmtpConfigIn } from "../../services/smtpConfigService";

const EMPTY: SmtpConfigIn = {
  host: "", port: 587, username: "", password: "",
  from_email: "", from_name: "NUMI", use_tls: true, activo: true,
  use_numi_smtp: true,
};

function Field({
  id, label, type = "text", value, onChange, placeholder,
}: {
  id: string; label: string; type?: string; value: string | number;
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
        {label}
      </label>
      <input
        id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border px-3 py-2.5 text-sm outline-none"
        style={{
          borderColor: "var(--color-surface-border)",
          color: "var(--color-content-primary)",
          background: "var(--color-surface-card)",
        }}
      />
    </div>
  );
}

function parseErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message;
    // Si es un array de errores de Pydantic serializado, mostrar el primero
    try {
      const parsed = JSON.parse(msg);
      if (Array.isArray(parsed) && parsed[0]?.msg) return parsed[0].msg;
    } catch {}
    if (msg === "[object Object]") return "Error al guardar. Revisá los datos ingresados.";
    return msg;
  }
  return "Error al guardar";
}

export function AdminSmtpConfigPage() {
  const [form, setForm] = useState<SmtpConfigIn>(EMPTY);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    smtpConfigService.get()
      .then(data => { if (data) setForm(f => ({ ...f, ...data, password: "" })); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof SmtpConfigIn) => (v: string) =>
    setForm(f => ({ ...f, [k]: k === "port" ? Number(v) : v }));

  const useNumi = form.use_numi_smtp;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setSaveError(null); setSaved(false);
    try {
      await smtpConfigService.save(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(parseErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const res = await smtpConfigService.test(form);
      setTestResult(res);
    } catch (err) {
      setTestResult({ ok: false, message: parseErrorMessage(err) });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-16">
          <Loader size={28} style={{ color: "var(--color-primary)", animation: "spin 1s linear infinite" }} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center gap-3">
        <Mail size={22} style={{ color: "var(--color-primary)" }} />
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--color-content-primary)" }}>Configuración de email</h1>
          <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>Configurá cómo se envían las invitaciones a colaboradores</p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="rounded-xl border p-6 max-w-2xl flex flex-col gap-5"
          style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}>

          {saveError && <ErrorBanner message={saveError} />}

          {saved && (
            <div className="flex items-center gap-2 p-3 rounded-lg text-sm"
              style={{ background: "rgba(21,128,61,0.08)", color: "var(--color-state-present)", border: "1px solid rgba(21,128,61,0.2)" }}>
              <CheckCircle size={15} /> Configuración guardada correctamente
            </div>
          )}

          {/* Selector modo SMTP */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-content-secondary)" }}>
              Servidor de envío
            </p>

            <label
              className="flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors"
              style={{
                borderColor: useNumi ? "var(--color-primary)" : "var(--color-surface-border)",
                background: useNumi ? "var(--color-primary-xlight)" : "var(--color-surface-card)",
              }}
            >
              <input
                type="radio"
                name="smtp_mode"
                checked={useNumi}
                onChange={() => setForm(f => ({ ...f, use_numi_smtp: true }))}
                style={{ accentColor: "var(--color-primary)", marginTop: 2 }}
              />
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--color-content-primary)" }}>
                  Usar el servidor de NUMI{" "}
                  <span className="text-xs font-normal ml-1 px-1.5 py-0.5 rounded"
                    style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}>
                    Recomendado
                  </span>
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
                  Las invitaciones se envían usando la infraestructura de email de NUMI. Sin configuración adicional.
                </p>
              </div>
            </label>

            <label
              className="flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors"
              style={{
                borderColor: !useNumi ? "var(--color-primary)" : "var(--color-surface-border)",
                background: !useNumi ? "var(--color-primary-xlight)" : "var(--color-surface-card)",
              }}
            >
              <input
                type="radio"
                name="smtp_mode"
                checked={!useNumi}
                onChange={() => setForm(f => ({ ...f, use_numi_smtp: false }))}
                style={{ accentColor: "var(--color-primary)", marginTop: 2 }}
              />
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--color-content-primary)" }}>
                  Usar mi propio servidor SMTP
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
                  Configurá tu propio servidor de correo (Gmail, Outlook, SendGrid, etc.)
                </p>
              </div>
            </label>
          </div>

          {/* Formulario SMTP — solo visible en modo personalizado */}
          {!useNumi && (
            <>
              <div style={{ height: 1, background: "var(--color-surface-border)" }} />

              {testResult && (
                <div className="flex items-center gap-2 p-3 rounded-lg text-sm"
                  style={{
                    background: testResult.ok ? "rgba(21,128,61,0.08)" : "rgba(220,38,38,0.08)",
                    color: testResult.ok ? "var(--color-state-present)" : "var(--color-state-absent)",
                    border: `1px solid ${testResult.ok ? "rgba(21,128,61,0.2)" : "rgba(220,38,38,0.2)"}`,
                  }}>
                  {testResult.ok ? <CheckCircle size={15} /> : <XCircle size={15} />}
                  {testResult.message}
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--color-content-secondary)" }}>Servidor</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Field id="host" label="Host SMTP" placeholder="smtp.gmail.com" value={form.host} onChange={set("host")} />
                  </div>
                  <Field id="port" label="Puerto" type="number" placeholder="587" value={form.port} onChange={set("port")} />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--color-content-secondary)" }}>Credenciales</p>
                <div className="flex flex-col gap-3">
                  <Field id="username" label="Usuario" placeholder="usuario@gmail.com" value={form.username} onChange={set("username")} />
                  <div className="flex flex-col gap-1">
                    <label htmlFor="password" className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>Contraseña</label>
                    <div style={{ position: "relative" }}>
                      <input
                        id="password" type={showPass ? "text" : "password"} value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="Dejá vacío para no cambiarla" autoComplete="new-password"
                        className="rounded-lg border px-3 py-2.5 text-sm outline-none w-full"
                        style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)", paddingRight: 40 }}
                      />
                      <button type="button" onClick={() => setShowPass(s => !s)}
                        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-content-secondary)", padding: 0 }}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--color-content-secondary)" }}>Remitente</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="from_email" label="Email del remitente" placeholder="noreply@empresa.com" value={form.from_email} onChange={set("from_email")} />
                  <Field id="from_name" label="Nombre del remitente" placeholder="NUMI" value={form.from_name} onChange={set("from_name")} />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--color-content-secondary)" }}>Opciones</p>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.use_tls} onChange={e => setForm(f => ({ ...f, use_tls: e.target.checked }))} />
                    <span className="text-sm" style={{ color: "var(--color-content-primary)" }}>Usar TLS (STARTTLS)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
                    <span className="text-sm" style={{ color: "var(--color-content-primary)" }}>Envío de emails activo</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-start">
                <Button type="button" variant="secondary" onClick={handleTest}
                  loading={testing} disabled={!form.host || !form.username}>
                  Probar conexión
                </Button>
              </div>
            </>
          )}

          <div className="pt-2 border-t flex justify-end" style={{ borderColor: "var(--color-surface-border)" }}>
            <Button type="submit" loading={saving}>
              Guardar configuración
            </Button>
          </div>
        </div>
      </form>
    </AdminLayout>
  );
}
