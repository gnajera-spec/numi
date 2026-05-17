import { useEffect, useState, useCallback } from "react";
import { Calendar, X, Filter, Check, ChevronRight, History, Eye } from "lucide-react";
import { MedicoLayout } from "../../../components/MedicoLayout";
import { Button } from "../../../components/Button";
import { Badge, estadoToVariant } from "../../../components/Badge";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { Spinner } from "../../../components/Spinner";
import { licenciasService } from "../../../services/licenciasService";
import { adminLicenciasService, type AprobacionPaso } from "../../../services/adminLicenciasService";
import type { SolicitudLicencia, EstadoSolicitud, Paginated } from "../../../types";

const parseLocalDate = (s: string) => new Date(s + "T12:00:00");
const fmtDate = (s: string) =>
  parseLocalDate(s).toLocaleDateString("es-AR");

const estadoBadge: Record<EstadoSolicitud, { label: string }> = {
  pendiente:   { label: "Pendiente" },
  en_revision: { label: "En revisión" },
  aprobada:    { label: "Aprobada" },
  rechazada:   { label: "Rechazada" },
  cancelada:   { label: "Cancelada" },
};

// ── Historial Modal ───────────────────────────────────────────────────────────

const pasoEstadoIcon: Record<AprobacionPaso["estado"], { icon: string; color: string }> = {
  pendiente: { icon: "○", color: "var(--color-content-disabled)" },
  aprobado:  { icon: "✓", color: "var(--color-state-present)" },
  rechazado: { icon: "✗", color: "var(--color-state-absent)" },
  omitido:   { icon: "—", color: "var(--color-content-disabled)" },
};

function HistorialModal({ solicitudId, onClose }: { solicitudId: string; onClose: () => void }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-xl border p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--color-content-primary)" }}>
            <History size={16} style={{ color: "var(--color-primary)" }} />
            Estado del flujo de aprobación
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
                    <span className="text-base font-bold w-6 text-center" style={{ color }}>{icon}</span>
                    {idx < pasos.length - 1 && (
                      <div className="flex-1 w-px mt-1" style={{ background: "var(--color-surface-border)", minHeight: 12 }} />
                    )}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
                        Paso {paso.orden}: {paso.nombre_paso}
                      </span>
                      <span className="text-xs rounded-full px-2 py-0.5 font-medium capitalize"
                        style={{
                          background: paso.estado === "aprobado" ? "var(--color-state-present-bg, #f0fdf4)" : paso.estado === "rechazado" ? "#fef2f2" : "var(--color-surface-empty)",
                          color,
                        }}>
                        {paso.estado}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
                      {paso.tipo_aprobador === "rol" ? `Rol: ${paso.rol_aprobador ?? "—"}` : `Departamento: ${paso.departamento_nombre ?? "—"}`}
                    </p>
                    {paso.aprobado_por_nombre && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
                        {paso.estado === "aprobado" ? "Aprobado" : "Rechazado"} por <strong>{paso.aprobado_por_nombre}</strong>
                        {paso.fecha_decision && <> · {fmtDate(paso.fecha_decision)}</>}
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
      if (action === "aprobar") {
        await licenciasService.aprobarPaso(solicitud.id, comentario || undefined);
      } else {
        await licenciasService.rechazarPaso(solicitud.id, comentario);
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

        <div className="rounded-lg p-3 mb-4" style={{ background: "var(--color-surface-empty)" }}>
          {solicitud.user_nombre && (
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-content-primary)" }}>
              {solicitud.user_nombre}
              {solicitud.user_cuil && (
                <span className="font-normal ml-2 text-xs" style={{ color: "var(--color-content-secondary)" }}>
                  CUIL {solicitud.user_cuil}
                </span>
              )}
            </p>
          )}
          <p className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
            {solicitud.tipo_licencia.nombre}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
            {fmtDate(solicitud.fecha_inicio)} → {fmtDate(solicitud.fecha_fin)} · {solicitud.dias_habiles} días
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
            Nº {solicitud.numero_solicitud}
          </p>
          {solicitud.flujo_id && solicitud.paso_actual && (
            <p className="text-xs mt-1 font-medium" style={{ color: "#7c3aed" }}>
              Paso {solicitud.paso_actual} del flujo de aprobación
            </p>
          )}
          {/* Datos médicos */}
          {(solicitud.medico_nombre || solicitud.dias_reposo) && (
            <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--color-surface-border)" }}>
              <p className="text-xs font-semibold uppercase mb-1" style={{ color: "var(--color-content-secondary)", letterSpacing: "0.5px" }}>
                Datos médicos
              </p>
              {solicitud.medico_nombre && (
                <p className="text-xs" style={{ color: "var(--color-content-primary)" }}>
                  Dr. {solicitud.medico_nombre} {solicitud.medico_apellido}
                  {solicitud.medico_matricula && <> · Mat. {solicitud.medico_matricula}</>}
                </p>
              )}
              {solicitud.dias_reposo && (
                <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                  {solicitud.dias_reposo} días de reposo indicados
                </p>
              )}
            </div>
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
            <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
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

export function MedicoLicenciasPage() {
  const [data, setData] = useState<Paginated<SolicitudLicencia> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{
    solicitud: SolicitudLicencia;
    action: "aprobar" | "rechazar";
  } | null>(null);
  const [historialId, setHistorialId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // pendientesAprobacion now includes solo_ver steps (mi_tipo_accion tells us the action)
      const res = await licenciasService.pendientesAprobacion(page, 20);
      // Filter by estado if selected
      if (filtroEstado) {
        res.data = res.data.filter(s => s.estado === filtroEstado);
      }
      setData(res);
    } catch {
      setError("No se pudieron cargar las solicitudes médicas.");
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <MedicoLayout>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Calendar size={22} style={{ color: "var(--color-primary)" }} />
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--color-content-primary)" }}>
              Licencias Médicas
            </h1>
            <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
              Solicitudes de licencia médica del tenant
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: "var(--color-content-secondary)" }} />
          <select
            value={filtroEstado}
            onChange={(e) => { setFiltroEstado(e.target.value); setPage(1); }}
            className="rounded-lg border px-3 py-2 text-sm outline-none"
            style={{
              borderColor: "var(--color-surface-border)",
              color: "var(--color-content-primary)",
              background: "var(--color-surface-card)",
            }}
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
      ) : !data?.data?.length ? (
        <EmptyState
          icon={Calendar}
          title="Sin solicitudes médicas"
          description={filtroEstado ? `No hay solicitudes en estado "${filtroEstado}".` : "No hay solicitudes de licencia médica."}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {data.data.map((sol) => {
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
                      {/* Tipo + estado + número */}
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

                      {/* Colaborador */}
                      {sol.user_nombre && (
                        <p className="text-sm font-medium mb-0.5" style={{ color: "var(--color-content-primary)" }}>
                          {sol.user_nombre}
                          {sol.user_cuil && (
                            <span className="font-normal ml-2 text-xs" style={{ color: "var(--color-content-secondary)" }}>
                              CUIL {sol.user_cuil}
                            </span>
                          )}
                        </p>
                      )}

                      {/* Fechas */}
                      <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                        {fmtDate(sol.fecha_inicio)} → {fmtDate(sol.fecha_fin)} · {sol.dias_habiles} días hábiles
                      </p>

                      {/* Datos médicos resumidos */}
                      {sol.medico_nombre && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
                          Dr. {sol.medico_nombre} {sol.medico_apellido}
                          {sol.dias_reposo && <> · {sol.dias_reposo} días reposo</>}
                        </p>
                      )}

                      {sol.comentario_empleado && (
                        <p className="text-xs mt-1 italic" style={{ color: "var(--color-content-secondary)" }}>
                          "{sol.comentario_empleado}"
                        </p>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      {/* Botón historial siempre disponible si hay flujo */}
                      {sol.flujo_id && (
                        <button
                          onClick={() => setHistorialId(sol.id)}
                          className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
                          style={{ color: "var(--color-content-secondary)", borderColor: "var(--color-surface-border)" }}
                        >
                          <History size={12} /> Historial
                        </button>
                      )}

                      {/* Solo notificación — no puede aprobar ni rechazar */}
                      {sol.mi_tipo_accion === "solo_ver" && (
                        <span
                          className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg"
                          style={{ background: "var(--color-surface-empty)", color: "var(--color-content-secondary)" }}
                        >
                          <Eye size={12} /> Solo notificación
                        </span>
                      )}

                      {/* Puede actuar — aprobar o rechazar */}
                      {canReview && sol.mi_tipo_accion !== "solo_ver" && (
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

                      {!canReview && sol.mi_tipo_accion !== "solo_ver" && (
                        <span className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                          Procesada
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paginación */}
          {data.pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
                {data.total} solicitudes · Página {data.page} de {data.pages}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                  Anterior
                </Button>
                <Button variant="secondary" onClick={() => setPage(p => p + 1)} disabled={page >= data.pages}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
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
    </MedicoLayout>
  );
}
