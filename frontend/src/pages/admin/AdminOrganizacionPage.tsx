import { useEffect, useState, useCallback, type FormEvent } from "react";
import {
  Building2,
  GitBranch,
  Briefcase,
  FileSignature,
  Plus,
  X,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
} from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Spinner } from "../../components/Spinner";
import { organizacionService } from "../../services/organizacionService";
import type { Sede, Departamento, Puesto, Convenio } from "../../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className="text-xs rounded-full px-2 py-0.5 font-medium"
      style={{
        background: active ? "var(--color-state-present-bg, #f0fdf4)" : "var(--color-surface-empty)",
        color: active ? "var(--color-state-present)" : "var(--color-content-disabled)",
      }}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function FieldRow({
  label,
  id,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border px-3 py-2 text-sm outline-none"
        style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
      />
    </div>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div
        className="w-full max-w-md rounded-xl border p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" style={{ color: "var(--color-content-secondary)" }}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

type Tab = "sedes" | "departamentos" | "puestos" | "convenios";

const tabs: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "sedes", label: "Sedes", icon: Building2 },
  { id: "departamentos", label: "Departamentos", icon: GitBranch },
  { id: "puestos", label: "Puestos", icon: Briefcase },
  { id: "convenios", label: "Convenios", icon: FileSignature },
];

// ── Sedes tab ─────────────────────────────────────────────────────────────────

function SedesTab() {
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const [form, setForm] = useState({ nombre: "", direccion: "", ciudad: "", provincia: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await organizacionService.listSedes({ is_active: showInactive ? undefined : true });
      setSedes(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar sedes");
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await organizacionService.createSede({
        nombre: form.nombre,
        direccion: form.direccion || undefined,
        ciudad: form.ciudad || undefined,
        provincia: form.provincia || undefined,
      });
      setShowModal(false);
      setForm({ nombre: "", direccion: "", ciudad: "", provincia: "" });
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al crear sede");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (sede: Sede) => {
    try {
      await organizacionService.updateSede(sede.id, { is_active: !sede.is_active });
      load();
    } catch {
      // silent — user sees no change
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setShowInactive((v) => !v)}
          className="text-xs flex items-center gap-1"
          style={{ color: "var(--color-content-secondary)" }}
        >
          {showInactive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          {showInactive ? "Mostrando todas" : "Solo activas"}
        </button>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={14} /> Nueva sede
        </Button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : sedes.length === 0 ? (
        <EmptyState icon={Building2} title="Sin sedes" description="Creá la primera sede de tu empresa." />
      ) : (
        <div className="flex flex-col gap-2">
          {sedes.map((sede) => (
            <div
              key={sede.id}
              className="rounded-xl border px-4 py-3 flex items-center justify-between"
              style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>{sede.nombre}</span>
                  <ActiveBadge active={sede.is_active} />
                </div>
                {(sede.ciudad || sede.provincia) && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
                    {[sede.ciudad, sede.provincia].filter(Boolean).join(", ")}
                    {sede.direccion && ` · ${sede.direccion}`}
                  </p>
                )}
              </div>
              <button
                onClick={() => toggleActive(sede)}
                className="p-1 rounded hover:bg-gray-100 transition-colors"
                title={sede.is_active ? "Desactivar" : "Activar"}
                style={{ color: "var(--color-content-secondary)" }}
              >
                {sede.is_active ? <ToggleRight size={18} style={{ color: "var(--color-state-present)" }} /> : <ToggleLeft size={18} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title="Nueva sede" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            {formError && <ErrorBanner message={formError} />}
            <FieldRow id="s-nombre" label="Nombre *" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} required placeholder="Ej: Casa central" />
            <FieldRow id="s-dir" label="Dirección" value={form.direccion} onChange={(v) => setForm({ ...form, direccion: v })} placeholder="Ej: Av. Corrientes 1234" />
            <div className="grid grid-cols-2 gap-3">
              <FieldRow id="s-ciudad" label="Ciudad" value={form.ciudad} onChange={(v) => setForm({ ...form, ciudad: v })} placeholder="Buenos Aires" />
              <FieldRow id="s-prov" label="Provincia" value={form.provincia} onChange={(v) => setForm({ ...form, provincia: v })} placeholder="CABA" />
            </div>
            <div className="flex justify-end gap-2 mt-1">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit" loading={saving}>Crear</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Departamentos tab ─────────────────────────────────────────────────────────

function DeptNode({ dept, allDepts, onToggle }: { dept: Departamento; allDepts: Departamento[]; onToggle: (d: Departamento) => void }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div>
      <div
        className="rounded-xl border px-4 py-3 flex items-center justify-between"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        <div className="flex items-center gap-2">
          {dept.hijos.length > 0 && (
            <button onClick={() => setExpanded((v) => !v)} style={{ color: "var(--color-content-secondary)" }}>
              <ChevronRight size={14} className={`transition-transform ${expanded ? "rotate-90" : ""}`} />
            </button>
          )}
          <span className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>{dept.nombre}</span>
          <ActiveBadge active={dept.is_active} />
          {dept.hijos.length > 0 && (
            <span className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
              {dept.hijos.length} sub
            </span>
          )}
        </div>
        <button
          onClick={() => onToggle(dept)}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
          title={dept.is_active ? "Desactivar" : "Activar"}
          style={{ color: "var(--color-content-secondary)" }}
        >
          {dept.is_active ? <ToggleRight size={18} style={{ color: "var(--color-state-present)" }} /> : <ToggleLeft size={18} />}
        </button>
      </div>
      {expanded && dept.hijos.length > 0 && (
        <div className="ml-6 mt-2 flex flex-col gap-2">
          {dept.hijos.map((child) => (
            <DeptNode key={child.id} dept={child} allDepts={allDepts} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}

function DepartamentosTab() {
  const [depts, setDepts] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const [form, setForm] = useState({ nombre: "", padre_id: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const flatDepts = useCallback((list: Departamento[]): Departamento[] => {
    const out: Departamento[] = [];
    const walk = (items: Departamento[]) => items.forEach((d) => { out.push(d); walk(d.hijos); });
    walk(list);
    return out;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await organizacionService.listDepartamentos({ is_active: showInactive ? undefined : true });
      setDepts(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar departamentos");
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await organizacionService.createDepartamento({
        nombre: form.nombre,
        padre_id: form.padre_id || undefined,
      });
      setShowModal(false);
      setForm({ nombre: "", padre_id: "" });
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al crear departamento");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (dept: Departamento) => {
    try {
      await organizacionService.updateDepartamento(dept.id, { is_active: !dept.is_active });
      load();
    } catch { /* silent */ }
  };

  const rootDepts = depts.filter((d) => !d.padre_id);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setShowInactive((v) => !v)}
          className="text-xs flex items-center gap-1"
          style={{ color: "var(--color-content-secondary)" }}
        >
          {showInactive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          {showInactive ? "Mostrando todos" : "Solo activos"}
        </button>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={14} /> Nuevo departamento
        </Button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : rootDepts.length === 0 ? (
        <EmptyState icon={GitBranch} title="Sin departamentos" description="Creá el primer departamento." />
      ) : (
        <div className="flex flex-col gap-2">
          {rootDepts.map((dept) => (
            <DeptNode key={dept.id} dept={dept} allDepts={flatDepts(depts)} onToggle={toggleActive} />
          ))}
        </div>
      )}

      {showModal && (
        <Modal title="Nuevo departamento" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            {formError && <ErrorBanner message={formError} />}
            <FieldRow id="d-nombre" label="Nombre *" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} required placeholder="Ej: Recursos Humanos" />
            <div className="flex flex-col gap-1">
              <label htmlFor="d-padre" className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
                Departamento padre (opcional)
              </label>
              <select
                id="d-padre"
                value={form.padre_id}
                onChange={(e) => setForm({ ...form, padre_id: e.target.value })}
                className="rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
              >
                <option value="">— Sin padre (raíz) —</option>
                {flatDepts(depts).filter((d) => d.is_active).map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-1">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit" loading={saving}>Crear</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Puestos tab ───────────────────────────────────────────────────────────────

function PuestosTab() {
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const [form, setForm] = useState({ nombre: "", descripcion: "", meses_vigencia_aptitud: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await organizacionService.listPuestos({ is_active: showInactive ? undefined : true });
      setPuestos(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar puestos");
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const meses = form.meses_vigencia_aptitud ? parseInt(form.meses_vigencia_aptitud) : undefined;
      await organizacionService.createPuesto({
        nombre: form.nombre,
        descripcion: form.descripcion || undefined,
        meses_vigencia_aptitud: meses,
      });
      setShowModal(false);
      setForm({ nombre: "", descripcion: "", meses_vigencia_aptitud: "" });
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al crear puesto");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (puesto: Puesto) => {
    try {
      await organizacionService.updatePuesto(puesto.id, { is_active: !puesto.is_active });
      load();
    } catch { /* silent */ }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setShowInactive((v) => !v)}
          className="text-xs flex items-center gap-1"
          style={{ color: "var(--color-content-secondary)" }}
        >
          {showInactive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          {showInactive ? "Mostrando todos" : "Solo activos"}
        </button>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={14} /> Nuevo puesto
        </Button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : puestos.length === 0 ? (
        <EmptyState icon={Briefcase} title="Sin puestos" description="Creá el primer puesto de tu empresa." />
      ) : (
        <div className="flex flex-col gap-2">
          {puestos.map((puesto) => (
            <div
              key={puesto.id}
              className="rounded-xl border px-4 py-3 flex items-center justify-between"
              style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>{puesto.nombre}</span>
                  <ActiveBadge active={puesto.is_active} />
                  {puesto.meses_vigencia_aptitud && (
                    <span className="text-xs rounded-full px-2 py-0.5" style={{ background: "var(--color-surface-empty)", color: "var(--color-content-secondary)" }}>
                      Aptitud c/{puesto.meses_vigencia_aptitud}m
                    </span>
                  )}
                </div>
                {puesto.descripcion && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>{puesto.descripcion}</p>
                )}
              </div>
              <button
                onClick={() => toggleActive(puesto)}
                className="p-1 rounded hover:bg-gray-100 transition-colors"
                title={puesto.is_active ? "Desactivar" : "Activar"}
                style={{ color: "var(--color-content-secondary)" }}
              >
                {puesto.is_active ? <ToggleRight size={18} style={{ color: "var(--color-state-present)" }} /> : <ToggleLeft size={18} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title="Nuevo puesto" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            {formError && <ErrorBanner message={formError} />}
            <FieldRow id="p-nombre" label="Nombre *" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} required placeholder="Ej: Analista de RRHH" />
            <FieldRow id="p-desc" label="Descripción" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} placeholder="Descripción del puesto" />
            <FieldRow
              id="p-meses"
              label="Vigencia aptitud médica (meses)"
              value={form.meses_vigencia_aptitud}
              onChange={(v) => setForm({ ...form, meses_vigencia_aptitud: v })}
              type="number"
              placeholder="Ej: 12 (dejar vacío = sin vencimiento)"
            />
            <div className="flex justify-end gap-2 mt-1">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit" loading={saving}>Crear</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Convenios tab ─────────────────────────────────────────────────────────────

function ConveniosTab() {
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({ nombre: "", descripcion: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await organizacionService.listConvenios();
      setConvenios(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar convenios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await organizacionService.createConvenio({
        nombre: form.nombre,
        descripcion: form.descripcion || undefined,
      });
      setShowModal(false);
      setForm({ nombre: "", descripcion: "" });
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al crear convenio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setShowModal(true)}>
          <Plus size={14} /> Nuevo convenio
        </Button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : convenios.length === 0 ? (
        <EmptyState icon={FileSignature} title="Sin convenios" description="Registrá los convenios colectivos de tu empresa." />
      ) : (
        <div className="flex flex-col gap-2">
          {convenios.map((convenio) => (
            <div
              key={convenio.id}
              className="rounded-xl border px-4 py-3"
              style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>{convenio.nombre}</span>
                <ActiveBadge active={convenio.is_active} />
              </div>
              {convenio.descripcion && (
                <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>{convenio.descripcion}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title="Nuevo convenio" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            {formError && <ErrorBanner message={formError} />}
            <FieldRow id="c-nombre" label="Nombre *" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} required placeholder="Ej: UPCN" />
            <FieldRow id="c-desc" label="Descripción" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} placeholder="Descripción del convenio" />
            <div className="flex justify-end gap-2 mt-1">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit" loading={saving}>Crear</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export function AdminOrganizacionPage() {
  const [activeTab, setActiveTab] = useState<Tab>("sedes");

  return (
    <AdminLayout>
      <div>
        <div className="mb-6 flex items-center gap-3">
          <Building2 size={22} style={{ color: "var(--color-primary)" }} />
          <h1 className="text-[22px] font-bold" style={{ color: "var(--color-content-primary)" }}>
            Estructura organizacional
          </h1>
        </div>

        {/* Tab bar */}
        <div
          className="flex gap-1 p-1 rounded-xl mb-6"
          style={{ background: "var(--color-surface-empty)" }}
        >
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={
                activeTab === id
                  ? { background: "var(--color-surface-card)", color: "var(--color-primary)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                  : { color: "var(--color-content-secondary)" }
              }
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "sedes" && <SedesTab />}
        {activeTab === "departamentos" && <DepartamentosTab />}
        {activeTab === "puestos" && <PuestosTab />}
        {activeTab === "convenios" && <ConveniosTab />}
      </div>
    </AdminLayout>
  );
}
