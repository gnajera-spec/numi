import { useEffect, useState, useCallback } from "react";
import { Calendar, Plus, X } from "lucide-react";
import { licenciasService } from "../services/licenciasService";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { ErrorBanner } from "../components/ErrorBanner";
import { Spinner } from "../components/Spinner";
import type { TipoLicencia, SolicitudLicencia, SaldoLicencia, NuevaSolicitud, EstadoSolicitud } from "../types";

const estadoBadge: Record<EstadoSolicitud, { label: string; color: string; bg: string }> = {
  pendiente: { label: "Pendiente", color: "#fff", bg: "var(--color-state-pending)" },
  aprobada: { label: "Aprobada", color: "#fff", bg: "var(--color-state-present)" },
  rechazada: { label: "Rechazada", color: "#fff", bg: "var(--color-state-absent)" },
  cancelada: { label: "Cancelada", color: "var(--color-content-secondary)", bg: "var(--color-surface-empty)" },
};

function SaldoCard({ saldo }: { saldo: SaldoLicencia }) {
  const pct = saldo.dias_asignados > 0
    ? Math.round((saldo.dias_usados / saldo.dias_asignados) * 100)
    : 0;

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
    >
      <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-content-primary)" }}>
        {saldo.tipo_licencia_nombre}
      </p>
      <div className="flex justify-between text-xs mb-2" style={{ color: "var(--color-content-secondary)" }}>
        <span>{saldo.dias_disponibles} disponibles</span>
        <span>{saldo.dias_asignados} totales</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-surface-border)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: "var(--color-primary)" }}
        />
      </div>
      <div className="flex justify-between text-xs mt-2" style={{ color: "var(--color-content-secondary)" }}>
        <span>{saldo.dias_usados} usados</span>
        <span>{saldo.dias_pendientes} pendientes</span>
      </div>
    </div>
  );
}

interface NewLeaveModalProps {
  tipos: TipoLicencia[];
  saldos: SaldoLicencia[];
  onClose: () => void;
  onCreated: () => void;
}

function NewLeaveModal({ tipos, saldos, onClose, onCreated }: NewLeaveModalProps) {
  const [form, setForm] = useState<NuevaSolicitud>({
    tipo_licencia_id: tipos[0]?.id ?? "",
    fecha_inicio: "",
    fecha_fin: "",
    comentario: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tipoSeleccionado = tipos.find((t) => t.id === form.tipo_licencia_id);
  const saldoDisponible = saldos.find(
    (s) => s.tipo_licencia_id === form.tipo_licencia_id
  );

  const diasSolicitados =
    form.fecha_inicio && form.fecha_fin
      ? Math.max(
          0,
          Math.round(
            (new Date(form.fecha_fin).getTime() - new Date(form.fecha_inicio).getTime()) /
              (1000 * 60 * 60 * 24)
          ) + 1
        )
      : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await licenciasService.crear(form);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear solicitud");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-xl border p-6"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>
            Nueva solicitud de licencia
          </h2>
          <button onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="tipo" className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Tipo de licencia
            </label>
            <select
              id="tipo"
              required
              value={form.tipo_licencia_id}
              onChange={(e) => setForm((f) => ({ ...f, tipo_licencia_id: e.target.value }))}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
            >
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>

          {saldoDisponible && (
            <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
              Saldo disponible: <strong>{saldoDisponible.dias_disponibles} días</strong>
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="fechaInicio" className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
                Desde
              </label>
              <input
                id="fechaInicio"
                type="date"
                required
                value={form.fecha_inicio}
                onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
                className="rounded-lg border px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="fechaFin" className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
                Hasta
              </label>
              <input
                id="fechaFin"
                type="date"
                required
                min={form.fecha_inicio}
                value={form.fecha_fin}
                onChange={(e) => setForm((f) => ({ ...f, fecha_fin: e.target.value }))}
                className="rounded-lg border px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
              />
            </div>
          </div>

          {diasSolicitados > 0 && (
            <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
              Días solicitados: <strong>{diasSolicitados}</strong>
            </p>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="comentario" className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Comentario (opcional)
            </label>
            <textarea
              id="comentario"
              rows={3}
              value={form.comentario}
              onChange={(e) => setForm((f) => ({ ...f, comentario: e.target.value }))}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none resize-none"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
            />
          </div>

          {tipoSeleccionado?.requiere_certificado && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: "#fef0ee", color: "var(--color-state-absent)" }}>
              Este tipo de licencia requiere adjuntar un certificado. Podrás agregarlo después de crear la solicitud.
            </p>
          )}

          <div className="flex justify-end gap-3 mt-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              Crear solicitud
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function LeavesPage() {
  const [solicitudes, setSolicitudes] = useState<SolicitudLicencia[]>([]);
  const [saldos, setSaldos] = useState<SaldoLicencia[]>([]);
  const [tipos, setTipos] = useState<TipoLicencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [solRes, saldosRes, tiposRes] = await Promise.allSettled([
        licenciasService.listMisSolicitudes(),
        licenciasService.getSaldo(),
        licenciasService.listTipos(),
      ]);

      if (solRes.status === "fulfilled") setSolicitudes(solRes.value.data);
      if (saldosRes.status === "fulfilled") setSaldos(saldosRes.value);
      if (tiposRes.status === "fulfilled") setTipos(tiposRes.value);

      if (solRes.status === "rejected") throw solRes.reason;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar licencias");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cancelar = async (id: string) => {
    try {
      await licenciasService.cancelar(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cancelar");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar size={22} style={{ color: "var(--color-primary)" }} />
          <h1 className="text-[22px] font-bold" style={{ color: "var(--color-content-primary)" }}>
            Licencias
          </h1>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} />
          Nueva solicitud
        </Button>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onRetry={load} /></div>}

      {loading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}

      {!loading && (
        <>
          {saldos.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-content-secondary)" }}>
                Saldo de días
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {saldos.map((s) => (
                  <SaldoCard key={s.tipo_licencia_id} saldo={s} />
                ))}
              </div>
            </div>
          )}

          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-content-secondary)" }}>
            Historial de solicitudes
          </h2>

          {solicitudes.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Sin solicitudes aún"
              description="Creá tu primera solicitud de licencia."
              action={
                <Button variant="secondary" onClick={() => setShowModal(true)}>
                  <Plus size={14} /> Nueva solicitud
                </Button>
              }
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
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm" style={{ color: "var(--color-content-primary)" }}>
                            {sol.tipo_licencia_nombre}
                          </span>
                          <span
                            className="text-xs font-semibold rounded-full px-2.5 py-0.5"
                            style={{ background: badge.bg, color: badge.color }}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: "var(--color-content-secondary)" }}>
                          {new Date(sol.fecha_inicio).toLocaleDateString("es-AR")} →{" "}
                          {new Date(sol.fecha_fin).toLocaleDateString("es-AR")} · {sol.dias_habiles} días
                        </p>
                        {sol.comentario_revisor && (
                          <p className="text-xs mt-1 italic" style={{ color: "var(--color-content-secondary)" }}>
                            "{sol.comentario_revisor}"
                          </p>
                        )}
                      </div>
                      {sol.estado === "pendiente" && (
                        <button
                          onClick={() => cancelar(sol.id)}
                          className="flex items-center gap-1 text-xs font-medium shrink-0"
                          style={{ color: "var(--color-state-absent)" }}
                        >
                          <X size={14} /> Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showModal && (
        <NewLeaveModal
          tipos={tipos}
          saldos={saldos}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
