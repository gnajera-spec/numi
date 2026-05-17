import { useEffect, useState, useRef } from "react";
import { Eye, EyeOff, Send, CheckCircle } from "lucide-react";
import { SuperAdminLayout } from "../../components/SuperAdminLayout";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Spinner } from "../../components/Spinner";
import { superAdminSmtpService, type NumiSmtpConfigIn } from "../../services/superAdminSmtpService";

interface FormState {
  host: string;
  port: string;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
  activo: boolean;
}

const emptyForm: FormState = {
  host: "",
  port: "587",
  username: "",
  password: "",
  from_email: "",
  from_name: "NUMI",
  use_tls: true,
  activo: true,
};

function toPayload(form: FormState): NumiSmtpConfigIn {
  return {
    host: form.host,
    port: Number(form.port) || 587,
    username: form.username,
    password: form.password,
    from_email: form.from_email,
    from_name: form.from_name,
    use_tls: form.use_tls,
    activo: form.activo,
  };
}

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[--color-primary] transition";
const inputStyle = {
  borderColor: "var(--color-surface-border)",
  color: "var(--color-content-primary)",
  background: "var(--color-surface-app)",
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-4"
      style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-card)" }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-content-disabled)" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
        {label}
      </label>
      {hint && <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>{hint}</p>}
      {children}
    </div>
  );
}

export function SuperAdminSmtpPage() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showTestInput, setShowTestInput] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const savedFormRef = useRef<FormState>(emptyForm);

  function applyConfig(cfg: Partial<FormState> | null) {
    if (!cfg) return;
    const loaded: FormState = {
      host: (cfg as { host?: string }).host ?? "",
      port: String((cfg as { port?: number }).port ?? 587),
      username: (cfg as { username?: string }).username ?? "",
      password: "",
      from_email: (cfg as { from_email?: string }).from_email ?? "",
      from_name: (cfg as { from_name?: string }).from_name ?? "NUMI",
      use_tls: (cfg as { use_tls?: boolean }).use_tls ?? true,
      activo: (cfg as { activo?: boolean }).activo ?? true,
    };
    setForm(loaded);
    savedFormRef.current = loaded;
    setIsDirty(false);
    setSaved(true);
  }

  useEffect(() => {
    superAdminSmtpService.get()
      .then((res) => applyConfig(res as Parameters<typeof applyConfig>[0]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (field: keyof FormState) => (value: string | boolean) => {
    setError(null);
    setSuccessMsg(null);
    setForm((c) => {
      const next = { ...c, [field]: value };
      const ref = savedFormRef.current;
      const dirty =
        (Object.keys(next) as (keyof FormState)[]).some(
          (k) => k !== "password" && next[k] !== ref[k]
        ) || next.password !== "";
      setIsDirty(dirty);
      if (dirty) setSaved(false);
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm("¿Guardar la configuración SMTP de NUMI?")) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await superAdminSmtpService.upsert(toPayload(form));
      setSuccessMsg("Configuración guardada correctamente.");
      savedFormRef.current = { ...form, password: "" };
      setForm((f) => ({ ...f, password: "" }));
      setIsDirty(false);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail.trim()) return;
    setTesting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await superAdminSmtpService.test(toPayload(form), testEmail.trim()) as unknown as { ok: boolean; message: string };
      if (res.ok) {
        setSuccessMsg(res.message || `Correo de prueba enviado a ${testEmail}.`);
        setShowTestInput(false);
        setTestEmail("");
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
      <SuperAdminLayout>
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="flex flex-col gap-6 max-w-2xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-content-primary)" }}>
              Servidor de email NUMI
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
              Este servidor será usado por todas las empresas que elijan "Servidor NUMI" como método de envío.
            </p>
          </div>
          {saved && !isDirty && (
            <div
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full shrink-0 mt-1"
              style={{ background: "var(--color-state-present-bg, #f0fdf4)", color: "var(--color-state-present)" }}
            >
              <CheckCircle size={13} />
              Configurado
            </div>
          )}
        </div>

        {error && <ErrorBanner message={error} />}

        {successMsg && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium"
            style={{ background: "var(--color-state-present-bg, #f0fdf4)", color: "var(--color-state-present)" }}
          >
            <CheckCircle size={15} />
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-4">

          {/* Servidor */}
          <SectionCard title="Servidor SMTP">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <FieldGroup label="Host">
                  <input
                    required
                    value={form.host}
                    onChange={(e) => set("host")(e.target.value)}
                    placeholder="smtp.tuempresa.com"
                    className={inputClass}
                    style={inputStyle}
                  />
                </FieldGroup>
              </div>
              <div style={{ width: 90 }}>
                <FieldGroup label="Puerto">
                  <input
                    required
                    type="number"
                    value={form.port}
                    onChange={(e) => set("port")(e.target.value)}
                    placeholder="587"
                    className={inputClass}
                    style={inputStyle}
                  />
                </FieldGroup>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={form.use_tls}
                onChange={(e) => set("use_tls")(e.target.checked)}
                className="w-4 h-4 rounded"
                style={{ accentColor: "var(--color-primary)" }}
              />
              <span className="text-sm" style={{ color: "var(--color-content-primary)" }}>Usar TLS/STARTTLS</span>
            </label>
          </SectionCard>

          {/* Credenciales */}
          <SectionCard title="Credenciales">
            <FieldGroup label="Usuario">
              <input
                value={form.username}
                onChange={(e) => set("username")(e.target.value)}
                placeholder="noreply@numi.app"
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
          </SectionCard>

          {/* Remitente */}
          <SectionCard title="Remitente">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldGroup label="Nombre">
                <input
                  value={form.from_name}
                  onChange={(e) => set("from_name")(e.target.value)}
                  placeholder="NUMI"
                  className={inputClass}
                  style={inputStyle}
                />
              </FieldGroup>
              <FieldGroup label="Email">
                <input
                  type="email"
                  value={form.from_email}
                  onChange={(e) => set("from_email")(e.target.value)}
                  placeholder="noreply@numi.app"
                  className={inputClass}
                  style={inputStyle}
                />
              </FieldGroup>
            </div>
          </SectionCard>

          {/* Acciones */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {isDirty && (
                <Button type="submit" disabled={saving}>
                  {saving ? "Guardando…" : "Guardar configuración"}
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                disabled={testing}
                onClick={() => setShowTestInput((v) => !v)}
                className="flex items-center gap-2"
              >
                <Send size={14} />
                Enviar correo de prueba
              </Button>
            </div>

            {showTestInput && (
              <div
                className="flex items-center gap-2 p-3 rounded-xl border"
                style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
              >
                <input
                  type="email"
                  autoFocus
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleTest())}
                  placeholder="destinatario@empresa.com"
                  className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[--color-primary] transition"
                  style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)", background: "var(--color-surface-app)" }}
                />
                <Button type="button" disabled={testing || !testEmail.trim()} onClick={handleTest}>
                  {testing ? "Enviando…" : "Enviar"}
                </Button>
                <button
                  type="button"
                  onClick={() => { setShowTestInput(false); setTestEmail(""); }}
                  className="p-2 rounded-lg text-sm transition hover:bg-[--color-surface-app]"
                  style={{ color: "var(--color-content-secondary)" }}
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

        </form>
      </div>
    </SuperAdminLayout>
  );
}
