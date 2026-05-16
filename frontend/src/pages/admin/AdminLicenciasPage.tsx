import { useEffect, useState, useCallback } from "react";
import { Calendar, Check, X, Clock, Filter } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Spinner } from "../../components/Spinner";
import { adminLicenciasService } from "../../services/adminLicenciasService";
import { Badge, estadoToVariant } from "../../components/Badge";
import type { SolicitudLicencia, EstadoSolicitud } from "../../types";

const estadoBadge: Record<EstadoSolicitud, { label: string; color: string; bg: string }> = {
  pendiente: { label: "Pendiente", color: "#fff", bg: "var(--color-state-pending)" },
  aprobada: { label: "Aprobada", color: "#fff", bg: "var(--color-state-present)" },
  rechazada: { label: "Rechazada", color: "#fff", bg: "var(--color-state-absent)" },
  cancelada: { label: "Cancelada", color: "var(--color-content-secondary)", bg: "var(--color-surface-empty)" },
};

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
        await adminLicenciasService.aprobar(solicitud.id, comentario);
      } else {
        await adminLicenciasService.rechazar(solicitud.id, comentario);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar");
    } finally {
      setLoading(false);
    }
  };

  const isAprobar = action === "aprobar";

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
          style={{ background: "var(--color-surface-empty)", borderColor: "var(--color-surface-border)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--color-content-primary)" }}>
            {solicitud.tipo_licencia_nombre}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
            {new Date(solicitud.fecha_inicio).toLocaleDateString("es-AR")} →{" "}
            {new Date(solicitud.fecha_fin).toLocaleDateString("es-AR")} · {solicitud.dias_habiles} días
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
            Nº {solicitud.numero}
          </p>
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

export function AdminLicenciasPage() {
  const [solicitudes, setSolicitudes] = useState<SolicitudLicencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string>("pendiente");
  const [modal, setModal] = useState<{
    solicitud: SolicitudLicencia;
    action: "aprobar" | "rechazar";
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminLicenciasService.listSolicitudes({
        estado: filtroEstado || undefined,
        page_size: 50,
      });
      setSolicitudes(res.data ?? []);
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
                        {sol.tipo_licencia_nombre}
                      </span>
                      <Badge variant={estadoToVariant(sol.estado)} label={badge.label} />
                      <span className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                        Nº {sol.numero}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                      {new Date(sol.fecha_inicio).toLocaleDateString("es-AR")} →{" "}
                      {new Date(sol.fecha_fin).toLocaleDateString("es-AR")} · {sol.dias_habiles} días hábiles
                    </p>
                    {sol.comentario_colaborador && (
                      <p className="text-xs mt-1 italic" style={{ color: "var(--color-content-secondary)" }}>
                        "{sol.comentario_colaborador}"
                      </p>
                    )}
                    {sol.comentario_revisor && (
                      <p className="text-xs mt-1" style={{ color: "var(--color-content-secondary)" }}>
                        Revisor: "{sol.comentario_revisor}"
                      </p>
                    )}
                  </div>

                  {sol.estado === "pendiente" && (
                    <div className="flex items-center gap-2 shrink-0">
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
                    </div>
                  )}
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
    </AdminLayout>
  );
}
