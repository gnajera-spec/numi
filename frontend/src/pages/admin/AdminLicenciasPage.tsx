import { useEffect, useState, useCallback } from "react";
import { Calendar, Check, X, Clock, Filter, History, ChevronRight } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Spinner } from "../../components/Spinner";
import { adminLicenciasService, type AprobacionPaso } from "../../services/adminLicenciasService";
import { Badge, estadoToVariant } from "../../components/Badge";
import type { SolicitudLicencia, EstadoSolicitud } from "../../types";

const parseLocalDate = (s: string) => new Date(s + "T12:00:00");
const fmtDate = (s: string) => parseLocalDate(s).toLocaleDateString("es-AR");

const estadoBadge: Record<EstadoSolicitud, { label: string }> = {
  pendiente: { label: "Pendiente" },
  en_revision: { label: "En revisión" },
  aprobada: { label: "Aprobada" },
  rechazada: { label: "Rechazada" },
  cancelada: { label: "Cancelada" },
};

const pasoEstadoIcon: Record<AprobacionPaso["estado"], { icon: string; color: string }> = {
  pendiente: { icon: "○", color: "var(--color-content-disabled)" },
  aprobado: { icon: "✓", color: "var(--color-state-present)" },
  rechazado: { icon: "✗", color: "var(--color-state-absent)" },
  omitido: { icon: "—", color: "var(--color-content-disabled)" },
};

// ── Historial Modal ──────────────────────────────────────────────────────────

interface HistorialModalProps {
  solicitudId: string;
  onClose: () => void;
}

function HistorialModal({ solicitudId, onClose }: HistorialModalProps) {
  const [pasos, setPasos] = useState<AprobacionPaso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminLicenciasService.getHistorial(solicitudId)
      .then((res) => setPasos(res as unknown as AprobacionPaso[]))
      .catch(() => setError("No se pudo cargar el historial."))
      .finally(() => setLoading(false));
  }, [solicitudId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-xl border p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--color-content-primary)" }}>
            <History size={16} style={{ color: "var(--color-primary)" }} />
            Historial de aprobación
          </h2>
          <button onClick={onClose} aria-label="Cerrar">
            <X size={18} style={{ color: "var(--color-content-secondary)" }} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Spinner size={24} /></div>
        ) : error ? (
          <ErrorBanner message={error} />
        ) : pasos.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: "var(--color-content-secondary)" }}>
            Esta solicitud no tiene flujo de aprobación configurado.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {pasos.map((paso, idx) => {
              const { icon, color } = pasoEstadoIcon[paso.estado];
              return (
                <li key={paso.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="text-base font-bold w-6 text-center" style={{ color }}>
                      {icon}
                    </span>
                    {idx < pasos.length - 1 && (
                      <div className="flex-1 w-px mt-1" style={{ background: "var(--color-surface-border)", minHeight: 12 }} />
                    )}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
                        Paso {paso.orden}: {paso.nombre_paso}
                      </span>
                      <span
                        className="text-xs rounded-full px-2 py-0.5 font-medium capitalize"
                        style={{
                          background: paso.estado === "aprobado"
                            ? "var(--color-state-present-bg, #f0fdf4)"
                            : paso.estado === "rechazado"
                              ? "#fef2f2"
                              : "var(--color-surface-empty)",
                          color,
                        }}
                      >
                        {paso.estado}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
                      {paso.tipo_aprobador === "rol"
                        ? `Rol: ${paso.rol_aprobador ?? "—"}`
                        : `Departamento: ${paso.departamento_nombre ?? "—"}`}
                    </p>
                    {paso.aprobado_por_nombre && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
                        {paso.estado === "aprobado" ? "Aprobado" : "Rechazado"} por{" "}
                        <strong>{paso.aprobado_por_nombre}</strong>
                        {paso.fecha_decision && (
                          <> · {fmtDate(paso.fecha_decision)}</>
                        )}
                      </p>
                    )}
                    {paso.comentario && (
                      <p className="text-xs mt-1 italic" style={{ color: "var(--color-content-secondary)" }}>
                        "{paso.comentario}"
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex justify-end pt-1">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  );
}

// ── Review Modal ─────────────────────────────────────────────────────────────

interface ReviewModalProps {
  solicitud: SolicitudLicencia;
  action: "aprobar" | "rechazar";
  onClose: () => void;
  onDone: () => void;
}

function ReviewModal({ solicitud, action, onClose, onDone }: ReviewModalProps) {
  const [comentario, setComentario] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usesPasoFlow = !!solicitud.flujo_id;
  const isAprobar = action === "aprobar";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (action === "rechazar" && !comentario.trim()) {
      setError("El comentario es obligatorio al rechazar.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (usesPasoFlow) {
        if (action === "aprobar") {
          await adminLicenciasService.aprobarPaso(solicitud.id, comentario || undefined);
        } else {
          await adminLicenciasService.rechazarPaso(solicitud.id, comentario);
        }
      } else {
        if (action === "aprobar") {
          await adminLicenciasService.aprobar(solicitud.id, comentario);
        } else {
          await adminLicenciasService.rechazar(solicitud.id, comentario);
        }
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar");
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
        className="w-full max-w-md rounded-xl border p-6"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>
            {isAprobar ? "Aprobar solicitud" : "Rechazar solicitud"}
          </h2>
          <button onClick={onClose} aria-label="Cerrar">
            <X size={18} style={{ color: "var(--color-content-secondary)" }} />
          </button>
        </div>

        <div
          className="rounded-lg p-3 mb-4"
          style={{ background: "var(--color-surface-empty)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--color-content-primary)" }}>
            {solicitud.tipo_licencia.nombre}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
            {fmtDate(solicitud.fecha_inicio)} → {fmtDate(solicitud.fecha_fin)} · {solicitud.dias_habiles} días
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
            Nº {solicitud.numero_solicitud}
          </p>
          {usesPasoFlow && solicitud.paso_actual && (
            <p className="text-xs mt-1 font-medium" style={{ color: "#7c3aed" }}>
              Paso {solicitud.paso_actual} del flujo de aprobación
            </p>
          )}
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="comentario" className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Comentario {isAprobar ? "(opcional)" : "(requerido)"}
            </label>
            <textarea
              id="comentario"
              rows={3}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              required={!isAprobar}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none resize-none"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
              placeholder={isAprobar ? "Opcional — se enviará al colaborador" : "Indicar motivo del rechazo..."}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={loading}
              variant={isAprobar ? "primary" : "destructive"}
            >
              {isAprobar ? "Aprobar" : "Rechazar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AdminLicenciasPage() {
  const [solicitudes, setSolicitudes] = useState<SolicitudLicencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string>("pendiente");
  const [modal, setModal] = useState<{
    solicitud: SolicitudLicencia;
    action: "aprobar" | "rechazar";
  } | null>(null);
  const [historialId, setHistorialId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminLicenciasService.listSolicitudes({
        estado: filtroEstado || undefined,
        page_size: 50,
      });
      setSolicitudes(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  }, [filtroEstado]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Calendar size={22} style={{ color: "var(--color-primary)" }} />
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--color-content-primary)" }}>
              Licencias
            </h1>
            <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
              Gestión de solicitudes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: "var(--color-content-secondary)" }} />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="en_revision">En revisión</option>
            <option value="aprobada">Aprobadas</option>
            <option value="rechazada">Rechazadas</option>
            <option value="cancelada">Canceladas</option>
          </select>
        </div>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onRetry={load} /></div>}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size={28} /></div>
      ) : solicitudes.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Sin solicitudes"
          description={filtroEstado ? `No hay solicitudes en estado "${filtroEstado}".` : "No hay solicitudes de licencia."}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {solicitudes.map((sol) => {
            const badge = estadoBadge[sol.estado];
            const canReview = sol.estado === "pendiente" || sol.estado === "en_revision";
            return (
              <div
                key={sol.id}
                className="rounded-xl border px-5 py-4"
                style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm" style={{ color: "var(--color-content-primary)" }}>
                        {sol.tipo_licencia.nombre}
                      </span>
                      <Badge variant={estadoToVariant(sol.estado)} label={badge.label} />
                      {sol.flujo_id && sol.paso_actual && (
                        <span className="text-xs flex items-center gap-1" style={{ color: "#7c3aed" }}>
                          <ChevronRight size={11} />
                          Paso {sol.paso_actual}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                        Nº {sol.numero_solicitud}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                      {fmtDate(sol.fecha_inicio)} → {fmtDate(sol.fecha_fin)} · {sol.dias_habiles} días hábiles
                    </p>
                    {sol.comentario_empleado && (
                      <p className="text-xs mt-1 italic" style={{ color: "var(--color-content-secondary)" }}>
                        "{sol.comentario_empleado}"
                      </p>
                    )}
                    {sol.comentario_rrhh && (
                      <p className="text-xs mt-1" style={{ color: "var(--color-content-secondary)" }}>
                        Revisor: "{sol.comentario_rrhh}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {sol.flujo_id && (
                      <button
                        onClick={() => setHistorialId(sol.id)}
                        className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
                        style={{ color: "var(--color-content-secondary)", borderColor: "var(--color-surface-border)" }}
                      >
                        <History size={12} /> Historial
                      </button>
                    )}
                    {canReview && (
                      <>
                        <button
                          onClick={() => setModal({ solicitud: sol, action: "rechazar" })}
                          className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-red-50"
                          style={{ color: "var(--color-state-absent)", borderColor: "var(--color-surface-border)" }}
                        >
                          <X size={13} /> Rechazar
                        </button>
                        <button
                          onClick={() => setModal({ solicitud: sol, action: "aprobar" })}
                          className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-green-50"
                          style={{ color: "var(--color-state-present)", borderColor: "var(--color-surface-border)" }}
                        >
                          <Check size={13} /> Aprobar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <ReviewModal
          solicitud={modal.solicitud}
          action={modal.action}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(); }}
        />
      )}

      {historialId && (
        <HistorialModal
          solicitudId={historialId}
          onClose={() => setHistorialId(null)}
        />
      )}
    </AdminLayout>
  );
}
