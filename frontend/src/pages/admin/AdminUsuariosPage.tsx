import { useEffect, useState, useCallback } from "react";
import { Users, Plus, X, Search, UserCheck, UserX, UserMinus, RefreshCw } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Spinner } from "../../components/Spinner";
import { adminUsuariosService } from "../../services/adminUsuariosService";
import type { UserSummary, CreateUserRequest, EstadoUsuario, RolUsuario } from "../../types";

const estadoBadge: Record<EstadoUsuario, { label: string; color: string; bg: string }> = {
  activo: { label: "Activo", color: "#fff", bg: "var(--color-state-present)" },
  pendiente: { label: "Pendiente", color: "#fff", bg: "var(--color-state-pending)" },
  suspendido: { label: "Suspendido", color: "#fff", bg: "var(--color-state-absent)" },
  baja: { label: "De baja", color: "var(--color-content-secondary)", bg: "var(--color-surface-empty)" },
};

const rolLabel: Record<RolUsuario, string> = {
  colaborador: "Colaborador",
  rrhh: "RRHH",
  admin_empresa: "Admin empresa",
  super_admin: "Super admin",
  servicio_medico: "Servicio médico",
};

// ── Nuevo Usuario Modal ─────────────────────────────────────────────────────

interface NuevoUsuarioModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function NuevoUsuarioModal({ onClose, onCreated }: NuevoUsuarioModalProps) {
  const [form, setForm] = useState<CreateUserRequest>({
    email: "",
    first_name: "",
    last_name: "",
    cuil: "",
    role: "colaborador",
    whatsapp_numero: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await adminUsuariosService.create(form);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear usuario");
    } finally {
      setLoading(false);
    }
  };

  const field = (
    id: keyof CreateUserRequest,
    label: string,
    opts: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}
  ) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
        {label}
      </label>
      <input
        id={id}
        value={(form[id] as string) ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))}
        className="rounded-lg border px-3 py-2.5 text-sm outline-none"
        style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
        {...opts}
      />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-xl border p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>
            Nuevo usuario
          </h2>
          <button onClick={onClose} aria-label="Cerrar">
            <X size={18} style={{ color: "var(--color-content-secondary)" }} />
          </button>
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {field("first_name", "Nombre", { required: true, minLength: 2, placeholder: "Ej: Juan" })}
            {field("last_name", "Apellido", { required: true, minLength: 2, placeholder: "Ej: García" })}
          </div>

          {field("email", "Email", { required: true, type: "email", placeholder: "juan@empresa.com" })}
          {field("cuil", "CUIL", {
            required: true,
            pattern: "\\d{11}",
            placeholder: "11 dígitos sin guiones",
            maxLength: 11,
          })}

          <div className="flex flex-col gap-1">
            <label htmlFor="role" className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Rol
            </label>
            <select
              id="role"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as RolUsuario }))}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
            >
              <option value="colaborador">Colaborador</option>
              <option value="rrhh">RRHH</option>
              <option value="servicio_medico">Servicio médico</option>
            </select>
          </div>

          {field("whatsapp_numero", "WhatsApp (E.164)", {
            required: true,
            placeholder: "+5491112345678",
          })}

          {field("legajo", "Legajo (opcional)", { placeholder: "Nº de legajo" })}
          {field("fecha_ingreso", "Fecha de ingreso (opcional)", { type: "date" })}

          <div className="flex justify-end gap-3 mt-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              Crear usuario
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Confirmación de acción ──────────────────────────────────────────────────

interface ConfirmModalProps {
  title: string;
  message: string;
  variant: "danger" | "warning";
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

function ConfirmModal({ title, message, variant, loading, onConfirm, onClose }: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-xl border p-6"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        <h2 className="text-base font-semibold mb-2" style={{ color: "var(--color-content-primary)" }}>
          {title}
        </h2>
        <p className="text-sm mb-5" style={{ color: "var(--color-content-secondary)" }}>
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant={variant === "danger" ? "destructive" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────────────

type PendingAction = {
  type: "suspend" | "baja" | "reactivate";
  user: UserSummary;
};

export function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("activo");
  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminUsuariosService.list({
        estado: filtroEstado || undefined,
        search: search || undefined,
        page_size: 50,
      });
      setUsuarios(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, search]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async () => {
    if (!pendingAction) return;
    setActionLoading(true);
    try {
      const { type, user } = pendingAction;
      if (type === "suspend") await adminUsuariosService.suspend(user.id);
      else if (type === "baja") await adminUsuariosService.baja(user.id);
      else if (type === "reactivate") await adminUsuariosService.reactivate(user.id);
      setPendingAction(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar acción");
      setPendingAction(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleInvite = async (user: UserSummary) => {
    try {
      await adminUsuariosService.invite(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reenviar invitación");
    }
  };

  const confirmConfig: Record<
    PendingAction["type"],
    { title: string; message: (u: UserSummary) => string; variant: "danger" | "warning" }
  > = {
    suspend: {
      title: "Suspender usuario",
      message: (u) => `¿Suspender a ${u.full_name}? Sus sesiones activas serán invalidadas.`,
      variant: "warning",
    },
    baja: {
      title: "Dar de baja",
      message: (u) => `¿Dar de baja a ${u.full_name}? Esta acción no elimina el historial pero es definitiva.`,
      variant: "danger",
    },
    reactivate: {
      title: "Reactivar usuario",
      message: (u) => `¿Reactivar a ${u.full_name}?`,
      variant: "warning",
    },
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Users size={22} style={{ color: "var(--color-primary)" }} />
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--color-content-primary)" }}>
              Usuarios
            </h1>
            <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
              Gestión de colaboradores y staff
            </p>
          </div>
        </div>
        <Button onClick={() => setShowNuevoModal(true)}>
          <Plus size={16} />
          Nuevo usuario
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div
          className="flex items-center gap-2 rounded-lg border px-3 py-2 flex-1 min-w-[200px]"
          style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-card)" }}
        >
          <Search size={14} style={{ color: "var(--color-content-secondary)" }} />
          <input
            type="text"
            placeholder="Buscar por nombre, email o CUIL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm outline-none bg-transparent"
            style={{ color: "var(--color-content-primary)" }}
          />
        </div>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
        >
          <option value="">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="pendiente">Pendientes</option>
          <option value="suspendido">Suspendidos</option>
          <option value="baja">De baja</option>
        </select>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onRetry={load} /></div>}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size={28} /></div>
      ) : usuarios.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin usuarios"
          description={search ? `Sin resultados para "${search}".` : "No hay usuarios con este filtro."}
          action={
            !search ? (
              <Button variant="secondary" onClick={() => setShowNuevoModal(true)}>
                <Plus size={14} /> Nuevo usuario
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {usuarios.map((u) => {
            const badge = estadoBadge[u.estado];
            return (
              <div
                key={u.id}
                className="rounded-xl border px-5 py-3.5"
                style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-semibold text-sm" style={{ color: "var(--color-content-primary)" }}>
                        {u.full_name}
                      </span>
                      <span
                        className="text-xs font-semibold rounded-full px-2 py-0.5"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                      <span className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                        {rolLabel[u.role]}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                      {u.email}
                      {u.cuil ? ` · CUIL ${u.cuil}` : ""}
                      {u.sede_nombre ? ` · ${u.sede_nombre}` : ""}
                      {u.departamento_nombre ? ` · ${u.departamento_nombre}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {u.estado === "pendiente" && (
                      <button
                        onClick={() => handleInvite(u)}
                        className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-blue-50"
                        style={{ color: "var(--color-primary)", borderColor: "var(--color-surface-border)" }}
                      >
                        <RefreshCw size={12} /> Reenviar invitación
                      </button>
                    )}
                    {u.estado === "activo" && (
                      <button
                        onClick={() => setPendingAction({ type: "suspend", user: u })}
                        className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-yellow-50"
                        style={{ color: "var(--color-state-pending)", borderColor: "var(--color-surface-border)" }}
                      >
                        <UserX size={12} /> Suspender
                      </button>
                    )}
                    {u.estado === "suspendido" && (
                      <button
                        onClick={() => setPendingAction({ type: "reactivate", user: u })}
                        className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-green-50"
                        style={{ color: "var(--color-state-present)", borderColor: "var(--color-surface-border)" }}
                      >
                        <UserCheck size={12} /> Reactivar
                      </button>
                    )}
                    {(u.estado === "activo" || u.estado === "suspendido") && (
                      <button
                        onClick={() => setPendingAction({ type: "baja", user: u })}
                        className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-red-50"
                        style={{ color: "var(--color-state-absent)", borderColor: "var(--color-surface-border)" }}
                      >
                        <UserMinus size={12} /> Baja
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNuevoModal && (
        <NuevoUsuarioModal
          onClose={() => setShowNuevoModal(false)}
          onCreated={() => { setShowNuevoModal(false); load(); }}
        />
      )}

      {pendingAction && (
        <ConfirmModal
          title={confirmConfig[pendingAction.type].title}
          message={confirmConfig[pendingAction.type].message(pendingAction.user)}
          variant={confirmConfig[pendingAction.type].variant}
          loading={actionLoading}
          onConfirm={handleAction}
          onClose={() => setPendingAction(null)}
        />
      )}
    </AdminLayout>
  );
}
