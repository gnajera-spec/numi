import { useEffect, useState, useCallback, useRef, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  Building2, Plus, X, Search, Copy, Check,
  CheckCircle, PauseCircle, XCircle, ChevronRight,
  Users, Shield, AlertCircle, ChevronDown,
} from "lucide-react";
import { SuperAdminLayout } from "../../components/SuperAdminLayout";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Spinner } from "../../components/Spinner";
import { superAdminService } from "../../services/superAdminService";
import type { UserSummary } from "../../types";
import type {
  TenantSummary, TenantOut, TenantEstado, TenantPlan,
  CreateTenantRequest, UpdateTenantRequest, TenantCreateResponse,
} from "../../types";

// ── Badges ────────────────────────────────────────────────────────────────────

const planBadge: Record<TenantPlan, { label: string; color: string; bg: string }> = {
  starter:      { label: "Starter",      color: "#fff", bg: "#6366f1" },
  professional: { label: "Professional", color: "#fff", bg: "#0ea5e9" },
  enterprise:   { label: "Enterprise",   color: "#fff", bg: "#f59e0b" },
};

const estadoBadge: Record<TenantEstado, { label: string; icon: React.ElementType; color: string }> = {
  activo:    { label: "Activo",    icon: CheckCircle, color: "var(--color-state-present)" },
  suspendido:{ label: "Suspendido",icon: PauseCircle, color: "var(--color-state-pending)" },
  baja:      { label: "Baja",      icon: XCircle,     color: "var(--color-state-absent)" },
};


// ── CreateTenantModal ─────────────────────────────────────────────────────────

function CreateTenantModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (res: TenantCreateResponse) => void;
}) {
  const [form, setForm] = useState<CreateTenantRequest>({
    nombre: "",
    nombre_corto: "",
    cuit: "",
    subdominio: "",
    plan: "starter",
    admin_email: "",
    admin_first_name: "",
    admin_last_name: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof CreateTenantRequest, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const autoSubdominio = (nombre: string) =>
    nombre.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await superAdminService.createTenant(form);
      onCreated(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear empresa");
    } finally {
      setSaving(false);
    }
  };

  const inp = "rounded-lg border px-3 py-2 text-sm outline-none w-full";
  const sty = { borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-xl border flex flex-col overflow-hidden"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)", maxHeight: "90vh" }}>

        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: "var(--color-surface-border)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>Nueva empresa</h2>
          <button onClick={onClose}><X size={18} style={{ color: "var(--color-content-secondary)" }} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4 overflow-y-auto flex-1">
          {error && <ErrorBanner message={error} />}

          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-content-secondary)" }}>Datos de la empresa</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-xs font-medium" style={{ color: "var(--color-content-primary)" }}>Razón social *</label>
              <input required value={form.nombre}
                onChange={(e) => { set("nombre", e.target.value); if (!form.subdominio || form.subdominio === autoSubdominio(form.nombre)) set("subdominio", autoSubdominio(e.target.value)); }}
                className={inp} style={sty} placeholder="Empresa S.A." />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "var(--color-content-primary)" }}>Nombre corto *</label>
              <input required maxLength={50} value={form.nombre_corto} onChange={(e) => set("nombre_corto", e.target.value)}
                className={inp} style={sty} placeholder="EmpresaSA" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "var(--color-content-primary)" }}>CUIT * (11 dígitos)</label>
              <input required pattern="\d{11}" maxLength={11} value={form.cuit} onChange={(e) => set("cuit", e.target.value.replace(/\D/g, ""))}
                className={inp} style={sty} placeholder="30123456789" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "var(--color-content-primary)" }}>Subdominio *</label>
              <input required pattern="[a-z0-9][a-z0-9\-]{1,62}[a-z0-9]" value={form.subdominio} onChange={(e) => set("subdominio", e.target.value)}
                className={inp} style={sty} placeholder="empresa-sa" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "var(--color-content-primary)" }}>Plan *</label>
              <select required value={form.plan} onChange={(e) => set("plan", e.target.value as TenantPlan)} className={inp} style={sty}>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>

          <div className="border-t pt-4" style={{ borderColor: "var(--color-surface-border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--color-content-secondary)" }}>Administrador de la empresa</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: "var(--color-content-primary)" }}>Nombre *</label>
                <input required value={form.admin_first_name} onChange={(e) => set("admin_first_name", e.target.value)}
                  className={inp} style={sty} placeholder="Juan" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: "var(--color-content-primary)" }}>Apellido *</label>
                <input required value={form.admin_last_name} onChange={(e) => set("admin_last_name", e.target.value)}
                  className={inp} style={sty} placeholder="Pérez" />
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-xs font-medium" style={{ color: "var(--color-content-primary)" }}>Email *</label>
                <input required type="email" value={form.admin_email} onChange={(e) => set("admin_email", e.target.value)}
                  className={inp} style={sty} placeholder="admin@empresa.com" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t shrink-0" style={{ borderColor: "var(--color-surface-border)" }}>
            <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={saving}>Crear empresa</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── CredencialesModal ─────────────────────────────────────────────────────────

function CredencialesModal({ res, onClose }: { res: TenantCreateResponse; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(res.initial_password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="w-full max-w-sm rounded-xl border p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(52,107,240,0.1)" }}>
            <CheckCircle size={20} style={{ color: "var(--color-primary)" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--color-content-primary)" }}>Empresa creada</p>
            <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>{res.nombre}</p>
          </div>
        </div>

        <div className="rounded-lg border p-4 flex flex-col gap-3" style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-empty)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-content-secondary)" }}>Credenciales del admin — guardalas ahora</p>
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>Email</p>
              <p className="text-sm font-medium font-mono" style={{ color: "var(--color-content-primary)" }}>{res.admin_email}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>Contraseña inicial</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm font-medium font-mono flex-1 rounded px-2 py-1 border"
                  style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}>
                  {res.initial_password}
                </p>
                <button onClick={copy} className="p-1.5 rounded border transition-colors hover:bg-blue-50"
                  style={{ borderColor: "var(--color-surface-border)", color: copied ? "var(--color-state-present)" : "var(--color-content-secondary)" }}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs" style={{ color: "var(--color-state-absent)" }}>
            Esta contraseña no se vuelve a mostrar. Compartila con el administrador de la empresa.
          </p>
        </div>

        <Button onClick={onClose} className="w-full">Entendido</Button>
      </div>
    </div>
  );
}

// ── EditTenantModal ───────────────────────────────────────────────────────────

function EditTenantModal({ tenant, onClose, onUpdated }: {
  tenant: TenantOut; onClose: () => void; onUpdated: () => void;
}) {
  const [form, setForm] = useState<UpdateTenantRequest>({
    nombre: tenant.nombre,
    nombre_corto: tenant.nombre_corto,
    plan: tenant.plan,
    estado: tenant.estado,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await superAdminService.updateTenant(tenant.id, form);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setSaving(false);
    }
  };

  const inp = "rounded-lg border px-3 py-2 text-sm outline-none w-full";
  const sty = { borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-xl border p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>Editar empresa</h2>
          <button onClick={onClose}><X size={18} style={{ color: "var(--color-content-secondary)" }} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {error && <ErrorBanner message={error} />}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-content-primary)" }}>Razón social</label>
            <input value={form.nombre ?? ""} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} className={inp} style={sty} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-content-primary)" }}>Nombre corto</label>
            <input value={form.nombre_corto ?? ""} onChange={(e) => setForm((f) => ({ ...f, nombre_corto: e.target.value }))} className={inp} style={sty} maxLength={50} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "var(--color-content-primary)" }}>Plan</label>
              <select value={form.plan} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value as TenantPlan }))} className={inp} style={sty}>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "var(--color-content-primary)" }}>Estado</label>
              <select value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value as TenantEstado }))} className={inp} style={sty}>
                <option value="activo">Activo</option>
                <option value="suspendido">Suspendido</option>
                <option value="baja">Baja</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={saving}>Guardar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ── role helpers ─────────────────────────────────────────────────────────────


const roleLabel: Record<string, string> = {
  colaborador: "Colaborador",
  rrhh: "RRHH",
  admin_empresa: "Admin empresa",
  servicio_medico: "Servicio médico",
  super_admin: "Super admin",
};

const roleBg: Record<string, { bg: string; color: string }> = {
  colaborador:    { bg: "var(--color-surface-empty)",  color: "var(--color-content-secondary)" },
  rrhh:           { bg: "#eff6ff",                     color: "#1d4ed8" },
  admin_empresa:  { bg: "var(--color-primary-light)",  color: "var(--color-primary)" },
  servicio_medico:{ bg: "#f0fdf4",                     color: "#16a34a" },
  super_admin:    { bg: "#fef3c7",                     color: "#b45309" },
};

// ── RolesPopover ──────────────────────────────────────────────────────────────

const TENANT_ROLES = ["colaborador", "rrhh", "admin_empresa", "servicio_medico"] as const;

function RolesPopover({
  user,
  tenantId,
  onUpdated,
  onError,
}: {
  user: UserSummary;
  tenantId: string;
  onUpdated: (u: UserSummary) => void;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [popoverPos, setPopoverPos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const currentRoles = user.roles?.length ? user.roles : [user.role];

  // Open: snapshot position + reset draft (colaborador siempre incluido)
  function handleOpen() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPopoverPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    const base = currentRoles.includes("colaborador") ? currentRoles : ["colaborador", ...currentRoles];
    setDraft([...base]);
    setOpen(true);
  }

  // Close on outside click — checks both trigger and popover
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function toggleRole(r: string) {
    if (r === "colaborador") return; // siempre fijo
    setDraft(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
    );
  }

  async function apply() {
    setSaving(true);
    try {
      const updated = await superAdminService.setTenantUserRoles(tenantId, user.id, draft);
      onUpdated(updated);
      setOpen(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al actualizar roles");
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = JSON.stringify([...draft].sort()) !== JSON.stringify([...currentRoles].sort());
  const canApply = hasChanges && draft.length > 0 && !saving;

  return (
    <div className="relative shrink-0">
      {/* Trigger */}
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className="flex items-center gap-1 flex-wrap justify-end max-w-[180px] hover:opacity-80 transition-opacity"
        title="Editar roles"
      >
        {currentRoles.map(r => {
          const rb = roleBg[r] ?? roleBg.colaborador;
          return (
            <span key={r} className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: rb.bg, color: rb.color }}>
              {roleLabel[r] ?? r}
            </span>
          );
        })}
        <ChevronDown size={12} style={{ color: "var(--color-content-secondary)", flexShrink: 0 }} />
      </button>

      {/* Popover — rendered via portal so el overflow del drawer no lo corta */}
      {open && createPortal(
        <div
          ref={popoverRef}
          className="rounded-xl shadow-2xl border"
          style={{
            position: "fixed",
            top: popoverPos.top,
            right: popoverPos.right,
            zIndex: 9999,
            background: "var(--color-surface-card)",
            borderColor: "var(--color-surface-border)",
            minWidth: 230,
          }}
        >
          {/* Header */}
          <div className="px-3 pt-3 pb-2 border-b" style={{ borderColor: "var(--color-surface-border)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--color-content-primary)" }}>
              Roles asignados
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
              Colaborador es el rol base — no se puede quitar
            </p>
          </div>

          {/* Checkboxes */}
          <div className="py-1">
            {TENANT_ROLES.map(r => {
              const rb = roleBg[r];
              const locked = r === "colaborador";
              const checked = locked || draft.includes(r);
              return (
                <label
                  key={r}
                  onClick={() => toggleRole(r)}
                  className="flex items-center gap-2.5 px-3 py-2 select-none transition-colors"
                  style={{ cursor: locked ? "default" : "pointer" }}
                  onMouseEnter={e => { if (!locked) (e.currentTarget as HTMLElement).style.background = "var(--color-surface-empty)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
                >
                  <span
                    className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all"
                    style={{
                      borderColor: locked
                        ? "var(--color-content-disabled)"
                        : checked ? "var(--color-primary)" : "var(--color-surface-border)",
                      background: locked
                        ? "var(--color-surface-empty)"
                        : checked ? "var(--color-primary)" : "transparent",
                      opacity: locked ? 0.6 : 1,
                    }}
                  >
                    {checked && <Check size={10} color={locked ? "var(--color-content-disabled)" : "#fff"} strokeWidth={3} />}
                  </span>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full flex-1"
                    style={{ background: rb.bg, color: rb.color, opacity: locked ? 0.6 : 1 }}
                  >
                    {roleLabel[r]}
                  </span>
                  {locked && (
                    <span className="text-[10px] font-medium" style={{ color: "var(--color-content-disabled)" }}>
                      base
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-3 py-2.5 border-t flex items-center justify-between gap-2"
            style={{ borderColor: "var(--color-surface-border)" }}>
            <button
              onClick={() => setOpen(false)}
              className="text-xs px-2.5 py-1.5 rounded-lg"
              style={{ color: "var(--color-content-secondary)" }}
            >
              Cancelar
            </button>
            <button
              onClick={apply}
              disabled={!canApply}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-40"
              style={{ background: "var(--color-primary)", color: "#fff" }}
            >
              {saving ? "Guardando…" : "Aplicar"}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


// ── TenantUsersDrawer ─────────────────────────────────────────────────────────

function TenantUsersDrawer({
  tenant,
  onClose,
}: {
  tenant: TenantSummary;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    superAdminService.listTenantUsers(tenant.id)
      .then(setUsers)
      .catch(() => setError("No se pudieron cargar los usuarios."))
      .finally(() => setLoading(false));
  }, [tenant.id]);

  const initials = (u: UserSummary) =>
    `${u.first_name[0] ?? ""}${u.last_name[0] ?? ""}`.toUpperCase();

  const isAdmin = (u: UserSummary) =>
    (u.roles?.length ? u.roles : [u.role]).includes("admin_empresa");

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.25)" }}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col shadow-2xl"
        style={{ width: 480, background: "var(--color-surface-card)", borderLeft: "1px solid var(--color-surface-border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: "var(--color-surface-border)" }}>
          <div>
            <div className="flex items-center gap-2">
              <Users size={17} style={{ color: "var(--color-primary)" }} />
              <h2 className="text-base font-bold" style={{ color: "var(--color-content-primary)" }}>
                Usuarios — {tenant.nombre}
              </h2>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
              Gestioná roles y permisos de cada usuario
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[var(--color-surface-empty)]">
            <X size={17} style={{ color: "var(--color-content-secondary)" }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg mb-4"
              style={{ background: "#fef2f2", color: "#dc2626" }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <span className="text-sm" style={{ color: "var(--color-content-disabled)" }}>Cargando…</span>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <Users size={32} style={{ color: "var(--color-content-disabled)" }} />
              <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>Sin usuarios en este tenant</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {users.map(u => {
                const admin = isAdmin(u);
                return (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-[var(--color-surface-empty)]"
                    style={{ border: admin ? "1px solid var(--color-primary-light)" : "1px solid transparent" }}
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: admin ? "var(--color-primary)" : "var(--color-content-disabled)" }}>
                      {initials(u)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--color-content-primary)" }}>
                          {u.full_name}
                        </p>
                        {admin && <Shield size={12} style={{ color: "var(--color-primary)", flexShrink: 0 }} />}
                      </div>
                      <p className="text-xs truncate" style={{ color: "var(--color-content-secondary)" }}>{u.email}</p>
                    </div>

                    {/* Multi-role selector */}
                    <RolesPopover
                      user={u}
                      tenantId={tenant.id}
                      onUpdated={updated => setUsers(prev => prev.map(x => x.id === updated.id ? updated : x))}
                      onError={msg => setError(msg)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t shrink-0 flex items-center gap-2"
          style={{ borderColor: "var(--color-surface-border)" }}>
          <Shield size={14} style={{ color: "var(--color-primary)" }} />
          <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
            Los usuarios pueden tener <strong>múltiples roles</strong>. El rol primario determina su portal de acceso.
          </p>
        </div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SuperAdminTenantsPage() {
  const [items, setItems] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [filterPlan, setFilterPlan] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [newCreds, setNewCreds] = useState<TenantCreateResponse | null>(null);
  const [editing, setEditing] = useState<TenantOut | null>(null);
  const [managingUsers, setManagingUsers] = useState<TenantSummary | null>(null);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await superAdminService.listTenants({
        search: search || undefined,
        estado: filterEstado || undefined,
        plan: filterPlan || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar empresas");
    } finally {
      setLoading(false);
    }
  }, [search, filterEstado, filterPlan, page]);

  useEffect(() => { load(); }, [load]);

  const handleEdit = async (t: TenantSummary) => {
    try {
      const full = await superAdminService.getTenant(t.id);
      setEditing(full);
    } catch {
      setError("Error al cargar detalle");
    }
  };

  return (
    <SuperAdminLayout>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Building2 size={22} style={{ color: "var(--color-primary)" }} />
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--color-content-primary)" }}>Empresas</h1>
            <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
              {total} empresa{total !== 1 ? "s" : ""} registrada{total !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={15} /> Nueva empresa
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-content-disabled)" }} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar empresa…"
            className="rounded-lg border pl-8 pr-3 py-1.5 text-sm outline-none"
            style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)", width: 200 }} />
        </div>

        <div className="flex gap-1">
          {(["", "activo", "suspendido", "baja"] as const).map((e) => (
            <button key={e} onClick={() => { setFilterEstado(e); setPage(1); }}
              className="text-xs rounded-full px-3 py-1.5 font-medium transition-colors"
              style={filterEstado === e
                ? { background: "var(--color-primary)", color: "#fff" }
                : { background: "var(--color-surface-empty)", color: "var(--color-content-secondary)" }}>
              {e === "" ? "Todos" : e.charAt(0).toUpperCase() + e.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {(["", "starter", "professional", "enterprise"] as const).map((p) => (
            <button key={p} onClick={() => { setFilterPlan(p); setPage(1); }}
              className="text-xs rounded-full px-3 py-1.5 font-medium transition-colors"
              style={filterPlan === p
                ? { background: "var(--color-primary)", color: "#fff" }
                : { background: "var(--color-surface-empty)", color: "var(--color-content-secondary)" }}>
              {p === "" ? "Todos los planes" : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Sin empresas"
          description="Creá la primera empresa en la plataforma."
          action={<Button variant="secondary" onClick={() => setShowCreate(true)}><Plus size={14} /> Nueva empresa</Button>}
        />
      ) : (
        <>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--color-surface-border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--color-surface-empty)", borderBottom: `1px solid var(--color-surface-border)` }}>
                  <th className="text-left px-4 py-3 font-medium text-xs" style={{ color: "var(--color-content-secondary)" }}>Empresa</th>
                  <th className="text-left px-3 py-3 font-medium text-xs" style={{ color: "var(--color-content-secondary)" }}>CUIT</th>
                  <th className="text-left px-3 py-3 font-medium text-xs hidden sm:table-cell" style={{ color: "var(--color-content-secondary)" }}>Plan</th>
                  <th className="text-left px-3 py-3 font-medium text-xs" style={{ color: "var(--color-content-secondary)" }}>Estado</th>
                  <th className="text-left px-3 py-3 font-medium text-xs hidden md:table-cell" style={{ color: "var(--color-content-secondary)" }}>Usuarios</th>
                  <th className="text-right px-4 py-3 font-medium text-xs" style={{ color: "var(--color-content-secondary)" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t, i) => {
                  const plan = planBadge[t.plan];
                  const estado = estadoBadge[t.estado];
                  const EstadoIcon = estado.icon;
                  return (
                    <tr key={t.id} style={{ borderTop: i > 0 ? `1px solid var(--color-surface-border)` : undefined }}>
                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ color: "var(--color-content-primary)" }}>{t.nombre}</p>
                        <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>{t.subdominio}</p>
                      </td>
                      <td className="px-3 py-3 text-xs font-mono" style={{ color: "var(--color-content-secondary)" }}>
                        {(t as unknown as { cuit?: string }).cuit ?? "—"}
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        <span className="text-xs font-medium rounded-full px-2.5 py-0.5" style={{ background: plan.bg, color: plan.color }}>
                          {plan.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-1 text-xs font-medium" style={{ color: estado.color }}>
                          <EstadoIcon size={12} />
                          {estado.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <button
                          onClick={() => setManagingUsers(t)}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-[var(--color-primary-light)]"
                          style={{ color: "var(--color-primary)", borderColor: "var(--color-primary-light)" }}
                        >
                          <Users size={12} /> Gestionar
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleEdit(t)}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-gray-50"
                          style={{ color: "var(--color-primary)", borderColor: "var(--color-surface-border)" }}
                        >
                          Editar <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                Página {page} de {Math.ceil(total / PAGE_SIZE)}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>Anterior</Button>
                <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={page * PAGE_SIZE >= total}>Siguiente</Button>
              </div>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <CreateTenantModal
          onClose={() => setShowCreate(false)}
          onCreated={(res) => { setShowCreate(false); setNewCreds(res); load(); }}
        />
      )}

      {newCreds && (
        <CredencialesModal res={newCreds} onClose={() => setNewCreds(null)} />
      )}

      {editing && (
        <EditTenantModal
          tenant={editing}
          onClose={() => setEditing(null)}
          onUpdated={() => { setEditing(null); load(); }}
        />
      )}

      {managingUsers && (
        <TenantUsersDrawer
          tenant={managingUsers}
          onClose={() => setManagingUsers(null)}
        />
      )}
    </SuperAdminLayout>
  );
}
