import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, User } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Spinner } from "../../components/Spinner";
import { adminUsuariosService } from "../../services/adminUsuariosService";
import { organizacionService } from "../../services/organizacionService";
import type { UserDetail, EstadoUsuario, Sede, Departamento, Puesto, Convenio, UpdateUserRequest } from "../../types";

const estadoVariant: Record<EstadoUsuario, "success" | "warning" | "error" | "neutral"> = {
  activo:     "success",
  pendiente:  "warning",
  suspendido: "error",
  baja:       "neutral",
};
const estadoLabel: Record<EstadoUsuario, string> = {
  activo:     "Activo",
  pendiente:  "Pendiente",
  suspendido: "Suspendido",
  baja:       "De baja",
};

/* ── Field label ─────────────────────────────────────────────────────────── */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold uppercase" style={{
      color: "var(--color-content-secondary)", letterSpacing: "0.6px",
    }}>
      {children}
    </label>
  );
}

/* ── Text input ──────────────────────────────────────────────────────────── */
function TextInput({
  value, onChange, placeholder, disabled,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
      style={{
        borderColor: "var(--color-surface-border)",
        color: "var(--color-content-primary)",
        background: disabled ? "var(--color-surface-empty)" : "var(--color-surface-card)",
      }}
    />
  );
}

/* ── Select input ────────────────────────────────────────────────────────── */
function SelectInput({
  value, onChange, children, disabled,
}: {
  value: string; onChange: (v: string) => void;
  children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
      style={{
        borderColor: "var(--color-surface-border)",
        color: value ? "var(--color-content-primary)" : "var(--color-content-secondary)",
        background: disabled ? "var(--color-surface-empty)" : "var(--color-surface-card)",
      }}
    >
      {children}
    </select>
  );
}

/* ── Sección del formulario ──────────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-content-primary)" }}>
        {title}
      </h3>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   AdminColaboradorDetailPage
   ══════════════════════════════════════════════════════════════════════════ */
export function AdminColaboradorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [user, setUser]       = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved]     = useState(false);

  // Org data for dropdowns
  const [sedes, setSedes]             = useState<Sede[]>([]);
  const [departamentos, setDepts]     = useState<Departamento[]>([]);
  const [puestos, setPuestos]         = useState<Puesto[]>([]);
  const [convenios, setConvenios]     = useState<Convenio[]>([]);

  // Form state (legajo laboral)
  const [firstName, setFirstName]     = useState("");
  const [lastName, setLastName]       = useState("");
  const [sedeId, setSedeId]           = useState("");
  const [deptId, setDeptId]           = useState("");
  const [puestoId, setPuestoId]       = useState("");
  const [convenioId, setConvenioId]   = useState("");
  const [legajo, setLegajo]           = useState("");
  const [fechaIngreso, setFechaIngreso] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      adminUsuariosService.getOne(id),
      organizacionService.listSedes({ is_active: true }),
      organizacionService.listDepartamentos({ is_active: true }),
      organizacionService.listPuestos({ is_active: true }),
      organizacionService.listConvenios(),
    ])
      .then(([u, sedesRes, deptsData, puestosRes, conveniosData]) => {
        setUser(u);
        setSedes(sedesRes.items ?? []);
        setDepts(deptsData);
        setPuestos(puestosRes.items ?? []);
        setConvenios(conveniosData);

        // Populate form
        setFirstName(u.first_name ?? "");
        setLastName(u.last_name ?? "");
        const p = u.colaborador_perfil;
        setSedeId(p?.sede_id ?? "");
        setDeptId(p?.departamento_id ?? "");
        setPuestoId(p?.puesto_id ?? "");
        setConvenioId(p?.convenio_id ?? "");
        setLegajo(p?.legajo ?? "");
        setFechaIngreso(p?.fecha_ingreso ?? "");
      })
      .catch(err => setError(err instanceof Error ? err.message : "Error al cargar colaborador"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const payload: UpdateUserRequest = {
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        sede_id: sedeId || null,
        departamento_id: deptId || null,
        puesto_id: puestoId || null,
        convenio_id: convenioId || null,
        legajo: legajo.trim() || null,
        fecha_ingreso: fechaIngreso || null,
      };
      const updated = await adminUsuariosService.update(id, payload);
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      </AdminLayout>
    );
  }

  if (error || !user) {
    return (
      <AdminLayout>
        <ErrorBanner message={error ?? "Colaborador no encontrado"} />
      </AdminLayout>
    );
  }

  // Flatten departamentos (tree → flat for select)
  const flatDepts: Departamento[] = [];
  const flattenDepts = (depts: Departamento[], prefix = "") => {
    for (const d of depts) {
      flatDepts.push({ ...d, nombre: prefix + d.nombre });
      if (d.hijos?.length) flattenDepts(d.hijos, prefix + d.nombre + " / ");
    }
  };
  flattenDepts(departamentos);

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button
          onClick={() => navigate("/admin/colaboradores")}
          className="flex items-center gap-1.5 text-sm"
          style={{ color: "var(--color-content-secondary)", background: "none", border: "none", cursor: "pointer" }}
        >
          <ArrowLeft size={15} /> Colaboradores
        </button>
        <span style={{ color: "var(--color-surface-border)" }}>/</span>
        <span className="text-sm font-semibold" style={{ color: "var(--color-content-primary)" }}>
          {user.full_name}
        </span>
      </div>

      {/* Info card */}
      <div
        className="rounded-xl border p-5 mb-5 flex items-center gap-4"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 12, flexShrink: 0,
          background: "var(--color-primary-xlight)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "0.5px",
        }}>
          {user.first_name[0]}{user.last_name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-base" style={{ color: "var(--color-content-primary)" }}>
              {user.full_name}
            </span>
            <Badge variant={estadoVariant[user.estado]} label={estadoLabel[user.estado]} />
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
            {user.email}
            {user.cuil && <> · CUIL {user.cuil}</>}
            {user.whatsapp_numero_masked && <> · {user.whatsapp_numero_masked}</>}
          </p>
        </div>
        <User size={18} style={{ color: "var(--color-content-secondary)", flexShrink: 0 }} />
      </div>

      {/* Form */}
      <div className="flex flex-col gap-4">

        {/* Datos personales */}
        <Section title="Datos personales">
          <Field label="Nombre">
            <TextInput value={firstName} onChange={setFirstName} />
          </Field>
          <Field label="Apellido">
            <TextInput value={lastName} onChange={setLastName} />
          </Field>
        </Section>

        {/* Legajo laboral */}
        <Section title="Legajo laboral">
          <Field label="N° de legajo">
            <TextInput value={legajo} onChange={setLegajo} placeholder="Ej: 001234" />
          </Field>
          <Field label="Fecha de ingreso">
            <input
              type="date"
              value={fechaIngreso}
              onChange={e => setFechaIngreso(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                borderColor: "var(--color-surface-border)",
                color: "var(--color-content-primary)",
                background: "var(--color-surface-card)",
              }}
            />
          </Field>
        </Section>

        {/* Estructura organizativa */}
        <Section title="Estructura organizativa">
          <Field label="Sede">
            <SelectInput value={sedeId} onChange={setSedeId}>
              <option value="">Sin asignar</option>
              {sedes.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Departamento">
            <SelectInput value={deptId} onChange={setDeptId}>
              <option value="">Sin asignar</option>
              {flatDepts.map(d => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Puesto">
            <SelectInput value={puestoId} onChange={setPuestoId}>
              <option value="">Sin asignar</option>
              {puestos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Convenio colectivo">
            <SelectInput value={convenioId} onChange={setConvenioId}>
              <option value="">Sin asignar</option>
              {convenios.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </SelectInput>
          </Field>
        </Section>

      </div>

      {/* Acciones */}
      <div className="flex items-center justify-between mt-6 flex-wrap gap-3">
        {saveError && <ErrorBanner message={saveError} />}
        {saved && (
          <span className="text-sm font-medium" style={{ color: "var(--color-state-present)" }}>
            Cambios guardados correctamente
          </span>
        )}
        {!saveError && !saved && <div />}
        <Button variant="primary" loading={saving} onClick={handleSave}>
          <Save size={14} style={{ marginRight: 6 }} />
          Guardar cambios
        </Button>
      </div>
    </AdminLayout>
  );
}
