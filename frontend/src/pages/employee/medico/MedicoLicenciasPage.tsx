import { useEffect, useState } from "react";
import { Calendar, X, ChevronDown } from "lucide-react";
import { MedicoLayout } from "../../../components/MedicoLayout";
import { Button } from "../../../components/Button";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { licenciasService } from "../../../services/licenciasService";
import type { SolicitudLicencia, Paginated } from "../../../types";

const ESTADOS = ["", "pendiente", "en_revision", "aprobada", "rechazada", "cancelada"] as const;
const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente", en_revision: "En revisión", aprobada: "Aprobada",
  rechazada: "Rechazada", cancelada: "Cancelada",
};
const ESTADO_COLOR: Record<string, { bg: string; color: string }> = {
  pendiente:   { bg: "#fef9c3", color: "#92400e" },
  en_revision: { bg: "#dbeafe", color: "#1e40af" },
  aprobada:    { bg: "#dcfce7", color: "#166534" },
  rechazada:   { bg: "#fee2e2", color: "#991b1b" },
  cancelada:   { bg: "#f3f4f6", color: "#6b7280" },
};

function Badge({ estado }: { estado: string }) {
  const c = ESTADO_COLOR[estado] ?? { bg: "#f3f4f6", color: "#6b7280" };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: c.bg, color: c.color }}>
      {ESTADO_LABEL[estado] ?? estado}
    </span>
  );
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

/* ── Modal revisión ──────────────────────────────────────────────────────── */
interface ReviewModalProps {
  sol: SolicitudLicencia;
  onClose: () => void;
  onDone: () => void;
}

function ReviewModal({ sol, onClose, onDone }: ReviewModalProps) {
  const [comentario, setComentario] = useState("");
  const [loading, setLoading] = useState<"aprobar" | "rechazar" | "derivar" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canAct = sol.estado === "pendiente" || sol.estado === "en_revision";

  const act = async (accion: "aprobar" | "rechazar" | "derivar") => {
    if (accion === "rechazar" && !comentario.trim()) {
      setError("El motivo de rechazo es obligatorio.");
      return;
    }
    setLoading(accion);
    setError(null);
    try {
      if (accion === "aprobar") {
        await licenciasService.aprobarPaso(sol.id, comentario || undefined);
      } else if (accion === "rechazar") {
        await licenciasService.rechazarPaso(sol.id, comentario);
      } else {
        await licenciasService.derivarPaso(sol.id, comentario || undefined);
      }
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al procesar la solicitud.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl shadow-xl p-6 flex flex-col gap-4" style={{ background: "var(--color-surface-card)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>Revisar solicitud médica</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={16} /></button>
        </div>

        {/* Datos del colaborador */}
        <div style={{ background: "var(--color-surface-app)", borderRadius: 12, padding: "12px 14px" }} className="flex flex-col gap-1.5">
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--color-content-primary)" }}>{sol.numero_solicitud}</p>
          <p style={{ margin: 0, fontSize: 12, color: "var(--color-content-secondary)" }}>
            {fmtDate(sol.fecha_inicio)} → {fmtDate(sol.fecha_fin)} · {sol.dias_habiles} días hábiles
          </p>
          {sol.comentario_empleado && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--color-content-secondary)" }}>"{sol.comentario_empleado}"</p>
          )}
          <Badge estado={sol.estado} />
        </div>

        {/* Datos médicos */}
        {(sol.medico_nombre || sol.dias_reposo) && (
          <div style={{ border: "1px solid var(--color-surface-border)", borderRadius: 10, padding: "10px 14px" }} className="flex flex-col gap-1">
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--color-content-secondary)" }}>Datos médicos</p>
            {sol.medico_nombre && (
              <p style={{ margin: 0, fontSize: 12, color: "var(--color-content-primary)" }}>
                Dr. {sol.medico_nombre} {sol.medico_apellido} {sol.medico_matricula ? `· Mat. ${sol.medico_matricula}` : ""}
              </p>
            )}
            {sol.dias_reposo && (
              <p style={{ margin: 0, fontSize: 12, color: "var(--color-content-secondary)" }}>{sol.dias_reposo} días de reposo indicados</p>
            )}
          </div>
        )}

        {canAct && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>Comentario / observación</label>
              <textarea
                rows={3}
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                placeholder="Opcional para aprobar, obligatorio para rechazar..."
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-app)", color: "var(--color-content-primary)", resize: "none" }}
              />
            </div>

            {error && <ErrorBanner message={error} />}

            <div className="flex gap-2 flex-wrap justify-end">
              <Button variant="secondary" type="button" onClick={onClose} disabled={!!loading}>Cancelar</Button>
              <Button
                type="button"
                onClick={() => act("derivar")}
                loading={loading === "derivar"}
                disabled={!!loading}
                style={{ background: "#2563eb", color: "#fff" }}
              >
                Derivar a RRHH
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => act("rechazar")}
                loading={loading === "rechazar"}
                disabled={!!loading}
              >
                Rechazar
              </Button>
              <Button
                type="button"
                onClick={() => act("aprobar")}
                loading={loading === "aprobar"}
                disabled={!!loading}
              >
                Aprobar
              </Button>
            </div>
          </>
        )}

        {!canAct && (
          <p style={{ fontSize: 13, color: "var(--color-content-secondary)", textAlign: "center" }}>
            Esta solicitud ya fue procesada (<Badge estado={sol.estado} />)
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Página principal ────────────────────────────────────────────────────── */
export function MedicoLicenciasPage() {
  const [data, setData] = useState<Paginated<SolicitudLicencia> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estadoFilter, setEstadoFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState<SolicitudLicencia | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await licenciasService.listMedicas({ estado: estadoFilter || undefined, page, page_size: 20 });
      setData(res);
    } catch {
      setError("No se pudieron cargar las solicitudes médicas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [estadoFilter, page]);

  return (
    <MedicoLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-content-primary)" }}>Licencias Médicas</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
              Solicitudes de licencia médica del tenant
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ position: "relative" }}>
              <select
                value={estadoFilter}
                onChange={e => { setEstadoFilter(e.target.value); setPage(1); }}
                className="rounded-lg border pl-3 pr-8 py-2 text-sm appearance-none outline-none"
                style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-card)", color: "var(--color-content-primary)" }}
              >
                {ESTADOS.map(e => (
                  <option key={e} value={e}>{e ? (ESTADO_LABEL[e] ?? e) : "Todos los estados"}</option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-content-secondary)", pointerEvents: "none" }} />
            </div>
          </div>
        </div>

        {error && <ErrorBanner message={error} onRetry={load} />}

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--color-content-secondary)", fontSize: 13 }}>Cargando…</div>
        ) : !data?.data?.length ? (
          <EmptyState icon={Calendar} title="Sin solicitudes médicas" description="No hay solicitudes médicas que coincidan con el filtro." />
        ) : (
          <>
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-card)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wide"
                    style={{ borderBottom: "1px solid var(--color-surface-border)", color: "var(--color-content-secondary)", background: "var(--color-surface-app)" }}>
                    <th className="px-4 py-3">N° Solicitud</th>
                    <th className="px-4 py-3 hidden md:table-cell">Colaborador</th>
                    <th className="px-4 py-3">Fechas</th>
                    <th className="px-4 py-3 text-center hidden sm:table-cell">Días</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--color-surface-border)" }}>
                  {data.data.map(sol => (
                    <tr key={sol.id} className="hover:bg-[--color-surface-app] transition-colors">
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--color-content-secondary)" }}>{sol.numero_solicitud}</td>
                      <td className="px-4 py-3 hidden md:table-cell font-medium" style={{ color: "var(--color-content-primary)" }}>
                        {(sol as unknown as { users?: { first_name: string; last_name: string } }).users
                          ? `${(sol as unknown as { users: { first_name: string; last_name: string } }).users.first_name} ${(sol as unknown as { users: { first_name: string; last_name: string } }).users.last_name}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--color-content-primary)" }}>
                        {fmtDate(sol.fecha_inicio)} → {fmtDate(sol.fecha_fin)}
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell" style={{ color: "var(--color-content-primary)" }}>{sol.dias_habiles}</td>
                      <td className="px-4 py-3 text-center"><Badge estado={sol.estado} /></td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setReviewing(sol)}
                          className="text-xs font-medium px-3 py-1 rounded-lg border transition-colors hover:bg-[--color-surface-app]"
                          style={{ color: "#1a7a45", borderColor: "#1a7a45" }}
                        >
                          Revisar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {data.pages > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
                  {data.total} solicitudes · Página {data.page} de {data.pages}
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Anterior</Button>
                  <Button variant="secondary" onClick={() => setPage(p => p + 1)} disabled={page >= data.pages}>Siguiente</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {reviewing && (
        <ReviewModal
          sol={reviewing}
          onClose={() => setReviewing(null)}
          onDone={() => { setReviewing(null); load(); }}
        />
      )}
    </MedicoLayout>
  );
}
