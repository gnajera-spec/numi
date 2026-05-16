import { useEffect, useState, useCallback, useRef } from "react";
import {
  Users, Plus, X, Search, UserCheck, UserX, UserMinus, RefreshCw,
  Copy, Mail, Upload, CheckCircle, AlertCircle, Download,
} from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Spinner } from "../../components/Spinner";
import { adminUsuariosService, invitacionesService } from "../../services/adminUsuariosService";
import type { InvitacionCreada, LoteResultado } from "../../services/adminUsuariosService";
import { Badge, estadoToVariant } from "../../components/Badge";
import type { UserSummary, EstadoUsuario, RolUsuario } from "../../types";
import { useAuth } from "../../contexts/AuthContext";

const estadoBadge: Record<EstadoUsuario, { label: string }> = {
  activo:     { label: "Activo" },
  pendiente:  { label: "Pendiente" },
  suspendido: { label: "Suspendido" },
  baja:       { label: "De baja" },
};

const rolLabel: Record<RolUsuario, string> = {
  colaborador:    "Colaborador",
  rrhh:           "RRHH",
  admin_empresa:  "Admin empresa",
  super_admin:    "Super admin",
  servicio_medico:"Servicio médico",
};

// ── Modal: Invitar colaborador individual ────────────────────────────────────

interface InvitarIndividualModalProps { onClose: () => void; onDone: () => void; }

function InvitarIndividualModal({ onClose, onDone }: InvitarIndividualModalProps) {
  const [cuil, setCuil] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<InvitacionCreada | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await invitacionesService.invitarIndividual(cuil.replace(/\D/g, ""), email);
      setResultado(res);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar invitación");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (!resultado) return;
    navigator.clipboard.writeText(resultado.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const overlay = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-xl border p-6"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>
            Nuevo colaborador
          </h2>
          <button onClick={onClose}><X size={18} style={{ color: "var(--color-content-secondary)" }} /></button>
        </div>

        {!resultado ? (
          <>
            {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>CUIL</label>
                <input
                  value={cuil} onChange={e => setCuil(e.target.value)}
                  placeholder="Ej: 20345678901" maxLength={14} required
                  className="rounded-lg border px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>Email</label>
                <input
                  value={email} onChange={e => setEmail(e.target.value)}
                  type="email" placeholder="colaborador@empresa.com" required
                  className="rounded-lg border px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
                />
              </div>
              <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                Se generará un enlace de registro. Podés copiarlo o enviarlo por email (si el SMTP está configurado).
              </p>
              <div className="flex justify-end gap-3 mt-1">
                <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
                <Button type="submit" loading={loading}>Generar enlace</Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--color-state-present)" }}>
              <CheckCircle size={16} />
              Invitación generada para {resultado.email}
            </div>
            <div
              className="rounded-lg border p-3 text-xs break-all font-mono"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-secondary)", background: "var(--color-surface-empty)" }}
            >
              {resultado.link}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={copyLink} className="flex-1">
                <Copy size={14} />
                {copied ? "¡Copiado!" : "Copiar enlace"}
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => window.open(`mailto:${resultado.email}?subject=Invitación NUMI&body=Tu enlace de registro: ${encodeURIComponent(resultado.link)}`)}
              >
                <Mail size={14} />
                Enviar por email
              </Button>
            </div>
            <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
              El enlace expira en 7 días.
            </p>
            <div className="flex justify-end">
              <Button onClick={onClose}>Cerrar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return overlay;
}

// ── Modal: Carga por lotes ───────────────────────────────────────────────────

interface InvitarLoteModalProps { onClose: () => void; onDone: () => void; }

function InvitarLoteModal({ onClose, onDone }: InvitarLoteModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<LoteResultado | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".csv")) { setError("El archivo debe ser un CSV"); return; }
    setFile(f); setError(null);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const res = await invitacionesService.invitarLoteCSV(file);
      setResultado(res);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar CSV");
    } finally {
      setLoading(false);
    }
  };

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
            Carga por lotes
          </h2>
          <button onClick={onClose}><X size={18} style={{ color: "var(--color-content-secondary)" }} /></button>
        </div>

        {!resultado ? (
          <div className="flex flex-col gap-4">
            {error && <ErrorBanner message={error} />}

            {/* Instrucciones CSV */}
            <div className="rounded-lg p-3 text-xs flex flex-col gap-1"
              style={{ background: "var(--color-surface-empty)", color: "var(--color-content-secondary)" }}>
              <p className="font-medium mb-1" style={{ color: "var(--color-content-primary)" }}>Formato del CSV</p>
              <p>El archivo debe tener dos columnas: <code>cuil</code> y <code>email</code></p>
              <pre className="mt-1 text-xs font-mono">cuil,email{"\n"}20345678901,juan@empresa.com{"\n"}27987654321,maria@empresa.com</pre>
              <button
                className="text-left mt-1 underline"
                style={{ color: "var(--color-primary)" }}
                onClick={() => {
                  const blob = new Blob(["cuil,email\n20345678901,ejemplo@empresa.com\n"], { type: "text/csv" });
                  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                  a.download = "plantilla_colaboradores.csv"; a.click();
                }}
              >
                <Download size={12} style={{ display: "inline", marginRight: 4 }} />
                Descargar plantilla
              </button>
            </div>

            {/* Drop zone */}
            <div
              className="rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors"
              style={{
                borderColor: dragging ? "var(--color-primary)" : "var(--color-surface-border)",
                background: dragging ? "rgba(232,125,80,0.05)" : "transparent",
              }}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={28} style={{ color: "var(--color-content-secondary)" }} />
              {file ? (
                <p className="text-sm font-medium" style={{ color: "var(--color-primary)" }}>{file.name}</p>
              ) : (
                <>
                  <p className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
                    Arrastrá el CSV aquí o hacé clic para seleccionarlo
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>Solo archivos .csv</p>
                </>
              )}
              <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleSubmit} loading={loading} disabled={!file}>
                Procesar CSV
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--color-content-primary)" }}>
              Resultado del procesamiento
            </div>
            {resultado.exitosos.length > 0 && (
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--color-state-present)", background: "rgba(21,128,61,0.05)" }}>
                <p className="text-sm font-medium mb-2 flex items-center gap-1" style={{ color: "var(--color-state-present)" }}>
                  <CheckCircle size={14} /> {resultado.exitosos.length} invitaciones generadas
                </p>
                <div className="flex flex-col gap-1">
                  {resultado.exitosos.map(inv => (
                    <div key={inv.token} className="flex items-center justify-between gap-2 text-xs">
                      <span style={{ color: "var(--color-content-secondary)" }}>{inv.email} · CUIL {inv.cuil}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(inv.link)}
                        className="shrink-0"
                        style={{ color: "var(--color-primary)" }}
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {resultado.errores.length > 0 && (
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--color-state-absent)", background: "rgba(220,38,38,0.05)" }}>
                <p className="text-sm font-medium mb-2 flex items-center gap-1" style={{ color: "var(--color-state-absent)" }}>
                  <AlertCircle size={14} /> {resultado.errores.length} errores
                </p>
                <div className="flex flex-col gap-1">
                  {resultado.errores.map((e, i) => (
                    <p key={i} className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                      {e.email} · {e.error}
                    </p>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={onClose}>Cerrar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal: Confirmación ──────────────────────────────────────────────────────

interface ConfirmModalProps {
  title: string; message: string; variant: "danger" | "warning";
  loading: boolean; onConfirm: () => void; onClose: () => void;
}
function ConfirmModal({ title, message, variant, loading, onConfirm, onClose }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-xl border p-6"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}>
        <h2 className="text-base font-semibold mb-2" style={{ color: "var(--color-content-primary)" }}>{title}</h2>
        <p className="text-sm mb-5" style={{ color: "var(--color-content-secondary)" }}>{message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant={variant === "danger" ? "destructive" : "primary"} onClick={onConfirm} loading={loading}>Confirmar</Button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────

type PendingAction = { type: "suspend" | "baja" | "reactivate"; user: UserSummary };

export function AdminUsuariosPage() {
  const { user } = useAuth();
  const canManageUsers = user?.role === "admin_empresa" || user?.role === "super_admin" || user?.role === "rrhh";
  const isAdminEmpresa = user?.role === "admin_empresa" || user?.role === "super_admin";

  const [usuarios, setUsuarios] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("activo");
  const [showInvitarModal, setShowInvitarModal] = useState(false);
  const [showLoteModal, setShowLoteModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await adminUsuariosService.list({ estado: filtroEstado || undefined, search: search || undefined, page_size: 50 });
      setUsuarios(res.data ?? []);
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
      setPendingAction(null); load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar acción");
      setPendingAction(null);
    } finally {
      setActionLoading(false);
    }
  };

  const confirmConfig: Record<PendingAction["type"], { title: string; message: (u: UserSummary) => string; variant: "danger" | "warning" }> = {
    suspend: { title: "Suspender usuario", message: (u) => `¿Suspender a ${u.full_name}? Sus sesiones activas serán invalidadas.`, variant: "warning" },
    baja:    { title: "Dar de baja",       message: (u) => `¿Dar de baja a ${u.full_name}? Esta acción no elimina el historial pero es definitiva.`, variant: "danger" },
    reactivate: { title: "Reactivar usuario", message: (u) => `¿Reactivar a ${u.full_name}?`, variant: "warning" },
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Users size={22} style={{ color: "var(--color-primary)" }} />
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--color-content-primary)" }}>Usuarios</h1>
            <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>Gestión de colaboradores y staff</p>
          </div>
        </div>
        {canManageUsers && (
          <div className="flex items-center gap-2">
            {isAdminEmpresa && (
              <Button onClick={() => setShowLoteModal(true)}>
                <Upload size={15} />
                Carga por lotes
              </Button>
            )}
            <Button onClick={() => setShowInvitarModal(true)}>
              <Plus size={15} />
              Nuevo colaborador
            </Button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2 flex-1 min-w-[200px]"
          style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-card)" }}>
          <Search size={14} style={{ color: "var(--color-content-secondary)" }} />
          <input type="text" placeholder="Buscar por nombre, email o CUIL..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-sm outline-none bg-transparent" style={{ color: "var(--color-content-primary)" }} />
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}>
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
        <EmptyState icon={Users} title="Sin usuarios"
          description={search ? `Sin resultados para "${search}".` : "No hay usuarios con este filtro."}
          action={!search ? <Button onClick={() => setShowInvitarModal(true)}><Plus size={14} /> Nuevo colaborador</Button> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {usuarios.map(u => (
            <div key={u.id} className="rounded-xl border px-5 py-3.5"
              style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-semibold text-sm" style={{ color: "var(--color-content-primary)" }}>{u.full_name}</span>
                    <Badge variant={estadoToVariant(u.estado)} label={estadoBadge[u.estado].label} />
                    <span className="text-xs" style={{ color: "var(--color-content-secondary)" }}>{rolLabel[u.role]}</span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                    {u.email}{u.cuil ? ` · CUIL ${u.cuil}` : ""}
                    {u.sede_nombre ? ` · ${u.sede_nombre}` : ""}
                    {u.departamento_nombre ? ` · ${u.departamento_nombre}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  {u.estado === "pendiente" && (
                    <button onClick={() => adminUsuariosService.invite(u.id)}
                      className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-blue-50"
                      style={{ color: "var(--color-primary)", borderColor: "var(--color-surface-border)" }}>
                      <RefreshCw size={12} /> Reenviar invitación
                    </button>
                  )}
                  {canManageUsers && u.estado === "activo" && u.id !== user?.id && (
                    <button onClick={() => setPendingAction({ type: "suspend", user: u })}
                      className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-yellow-50"
                      style={{ color: "var(--color-state-pending)", borderColor: "var(--color-surface-border)" }}>
                      <UserX size={12} /> Suspender
                    </button>
                  )}
                  {canManageUsers && u.estado === "suspendido" && u.id !== user?.id && (
                    <button onClick={() => setPendingAction({ type: "reactivate", user: u })}
                      className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-green-50"
                      style={{ color: "var(--color-state-present)", borderColor: "var(--color-surface-border)" }}>
                      <UserCheck size={12} /> Reactivar
                    </button>
                  )}
                  {canManageUsers && (u.estado === "activo" || u.estado === "suspendido") && u.id !== user?.id && (
                    <button onClick={() => setPendingAction({ type: "baja", user: u })}
                      className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-red-50"
                      style={{ color: "var(--color-state-absent)", borderColor: "var(--color-surface-border)" }}>
                      <UserMinus size={12} /> Baja
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showInvitarModal && (
        <InvitarIndividualModal onClose={() => setShowInvitarModal(false)} onDone={load} />
      )}
      {showLoteModal && (
        <InvitarLoteModal onClose={() => setShowLoteModal(false)} onDone={load} />
      )}
      {pendingAction && (
        <ConfirmModal
          title={confirmConfig[pendingAction.type].title}
          message={confirmConfig[pendingAction.type].message(pendingAction.user)}
          variant={confirmConfig[pendingAction.type].variant}
          loading={actionLoading} onConfirm={handleAction}
          onClose={() => setPendingAction(null)}
        />
      )}
    </AdminLayout>
  );
}
