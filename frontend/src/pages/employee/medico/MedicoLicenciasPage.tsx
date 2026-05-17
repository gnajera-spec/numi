import { useEffect, useState, useCallback } from "react";
import { Calendar, X, Filter, Check, ChevronRight, History } from "lucide-react";
import { MedicoLayout } from "../../../components/MedicoLayout";
import { Button } from "../../../components/Button";
import { Badge, estadoToVariant } from "../../../components/Badge";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { Spinner } from "../../../components/Spinner";
import { licenciasService } from "../../../services/licenciasService";
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await licenciasService.listMedicas({
        estado: filtroEstado || undefined,
        page,
        page_size: 20,
      });
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
                      {!canReview && (
                        <span className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                          <History size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
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
    </MedicoLayout>
  );
}
