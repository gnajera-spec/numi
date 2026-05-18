import { useEffect, useState, useCallback } from "react";
import { CheckSquare, Check, X, Clock } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { ErrorBanner } from "../components/ErrorBanner";
import { Spinner } from "../components/Spinner";
import { Button } from "../components/Button";
import { Badge, estadoToVariant } from "../components/Badge";
import { licenciasService } from "../services/licenciasService";
import { adminLicenciasService } from "../services/adminLicenciasService";
import type { SolicitudLicencia } from "../types";

const parseLocalDate = (s: string) => new Date(s + "T12:00:00");
const fmtDate = (s: string) => parseLocalDate(s).toLocaleDateString("es-AR");

const estadoLabel: Record<string, string> = {
  pendiente: "Pendiente",
  en_revision: "En revisión",
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
    if (!isAprobar && !comentario.trim()) {
      setError("El comentario es obligatorio al rechazar.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (solicitud.flujo_id) {
        if (isAprobar) {
          await adminLicenciasService.aprobarPaso(solicitud.id, comentario || undefined);
        } else {
          await adminLicenciasService.rechazarPaso(solicitud.id, comentario);
        }
      } else {
        if (isAprobar) {
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
          {solicitud.flujo_id && solicitud.paso_actual && (
            <p className="text-xs mt-1 font-medium" style={{ color: "#7c3aed" }}>
              Paso {solicitud.paso_actual} del flujo de aprobación
            </p>
          )}
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Comentario {isAprobar ? "(opcional)" : "(requerido)"}
            </label>
            <textarea
              rows={3}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              required={!isAprobar}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none resize-none"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
              placeholder={isAprobar ? "Opcional" : "Indicar motivo del rechazo..."}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading} variant={isAprobar ? "primary" : "destructive"}>
              {isAprobar ? "Aprobar" : "Rechazar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function MisPendientesPage() {
  const [solicitudes, setSolicitudes] = useState<SolicitudLicencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    solicitud: SolicitudLicencia;
    action: "aprobar" | "rechazar";
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await licenciasService.pendientesAprobacion();
      setSolicitudes(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-6">
      <div className="flex items-center gap-3 mb-6">
        <CheckSquare size={22} style={{ color: "var(--color-primary)" }} />
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--color-content-primary)" }}>
            Pendientes de aprobación
          </h1>
          <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
            Solicitudes que esperan tu revisión
          </p>
        </div>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onRetry={load} /></div>}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size={28} /></div>
      ) : solicitudes.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Sin pendientes"
          description="No tenés solicitudes esperando tu aprobación en este momento."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {solicitudes.map((sol) => (
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
                    <Badge
                      variant={estadoToVariant(sol.estado)}
                      label={estadoLabel[sol.estado] ?? sol.estado}
                    />
                    {sol.flujo_id && sol.paso_actual && (
                      <span className="text-xs" style={{ color: "#7c3aed" }}>
                        Paso {sol.paso_actual}
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                    {fmtDate(sol.fecha_inicio)} → {fmtDate(sol.fecha_fin)} · {sol.dias_habiles} días hábiles
                  </p>
                  {sol.comentario_empleado && (
                    <p className="text-xs mt-1 italic" style={{ color: "var(--color-content-secondary)" }}>
                      "{sol.comentario_empleado}"
                    </p>
                  )}
                  <p className="text-xs mt-1" style={{ color: "var(--color-content-disabled)" }}>
                    Nº {sol.numero_solicitud}
                  </p>
                </div>

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
              </div>
            </div>
          ))}
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
    </div>
  );
}
