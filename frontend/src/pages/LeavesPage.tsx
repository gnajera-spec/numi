import { useEffect, useState, useCallback } from "react";
import { Calendar, Plus, X, Stethoscope, Briefcase, Upload, FileText } from "lucide-react";
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

// ── Shared field wrapper ──────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
        {label}{required && <span className="ml-0.5" style={{ color: "var(--color-state-absent)" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-offset-0";
const inputStyle = { borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)", background: "var(--color-surface-card)" };

// ── Medical leave form ────────────────────────────────────────────────────────

interface MedicalFormProps {
  tipos: TipoLicencia[];
  onClose: () => void;
  onCreated: () => void;
}

function MedicalLeaveForm({ tipos, onClose, onCreated }: MedicalFormProps) {
  const tiposMedicos = tipos.filter((t) => t.es_medica);

  const [form, setForm] = useState({
    tipo_licencia_id: tiposMedicos[0]?.id ?? "",
    fecha_inicio: "",
    dias_reposo: "",
    medico_nombre: "",
    medico_apellido: "",
    medico_matricula: "",
    comentario: "",
  });
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  // Compute fecha_fin from fecha_inicio + dias_reposo
  const fechaFin = (() => {
    if (!form.fecha_inicio || !form.dias_reposo) return null;
    const d = new Date(form.fecha_inicio);
    d.setDate(d.getDate() + parseInt(form.dias_reposo) - 1);
    return d;
  })();

  const fechaAlta = (() => {
    if (!fechaFin) return null;
    const d = new Date(fechaFin);
    d.setDate(d.getDate() + 1);
    return d;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fechaFin) return;
    setError(null);
    setLoading(true);
    try {
      const payload: NuevaSolicitud = {
        tipo_licencia_id: form.tipo_licencia_id,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: fechaFin.toISOString().split("T")[0],
        comentario: form.comentario || undefined,
        medico_nombre: form.medico_nombre,
        medico_apellido: form.medico_apellido,
        medico_matricula: form.medico_matricula,
        dias_reposo: parseInt(form.dias_reposo),
      };
      const solicitud = await licenciasService.crear(payload);
      if (comprobante) {
        await licenciasService.subirDocumento(solicitud.id, comprobante);
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear solicitud");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      <Field label="Tipo de licencia" required>
        <select
          required
          value={form.tipo_licencia_id}
          onChange={(e) => set("tipo_licencia_id", e.target.value)}
          className={inputCls}
          style={inputStyle}
        >
          {tiposMedicos.map((t) => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
      </Field>

      {/* Doctor info */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre del médico" required>
          <input
            type="text"
            required
            placeholder="Ej: Carlos"
            value={form.medico_nombre}
            onChange={(e) => set("medico_nombre", e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        </Field>
        <Field label="Apellido del médico" required>
          <input
            type="text"
            required
            placeholder="Ej: García"
            value={form.medico_apellido}
            onChange={(e) => set("medico_apellido", e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="Matrícula médica" required>
        <input
          type="text"
          required
          placeholder="Ej: MN 12345"
          value={form.medico_matricula}
          onChange={(e) => set("medico_matricula", e.target.value)}
          className={inputCls}
          style={inputStyle}
        />
      </Field>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha de inicio" required>
          <input
            type="date"
            required
            value={form.fecha_inicio}
            onChange={(e) => set("fecha_inicio", e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        </Field>
        <Field label="Días de reposo (según prescripción)" required>
          <input
            type="number"
            required
            min={1}
            max={365}
            placeholder="Ej: 7"
            value={form.dias_reposo}
            onChange={(e) => set("dias_reposo", e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        </Field>
      </div>

      {fechaAlta && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs"
          style={{ background: "var(--color-surface-empty)", color: "var(--color-content-secondary)" }}
        >
          <Calendar size={13} />
          <span>
            Período: <strong>{new Date(form.fecha_inicio).toLocaleDateString("es-AR")}</strong>
            {" → "}
            <strong>{fechaFin!.toLocaleDateString("es-AR")}</strong>
            {" · Alta médica prevista: "}
            <strong style={{ color: "var(--color-state-present)" }}>{fechaAlta.toLocaleDateString("es-AR")}</strong>
          </span>
        </div>
      )}

      {/* Comprobante */}
      <Field label="Foto / escáner del certificado médico" required>
        <label
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 cursor-pointer transition-colors hover:border-current"
          style={{
            borderColor: comprobante ? "var(--color-state-present)" : "var(--color-surface-border)",
            background: comprobante ? "#f0fdf4" : "var(--color-surface-empty)",
            color: "var(--color-content-secondary)",
          }}
        >
          <input
            type="file"
            required
            accept="image/*,.pdf"
            className="sr-only"
            onChange={(e) => setComprobante(e.target.files?.[0] ?? null)}
          />
          {comprobante ? (
            <>
              <FileText size={20} style={{ color: "var(--color-state-present)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--color-state-present)" }}>
                {comprobante.name}
              </span>
              <span className="text-xs">Toca para cambiar</span>
            </>
          ) : (
            <>
              <Upload size={20} />
              <span className="text-xs font-medium">Subir foto o PDF del certificado</span>
              <span className="text-xs">JPG, PNG, PDF · máx. 10 MB</span>
            </>
          )}
        </label>
      </Field>

      <Field label="Comentario (opcional)">
        <textarea
          rows={2}
          value={form.comentario}
          onChange={(e) => set("comentario", e.target.value)}
          className={`${inputCls} resize-none`}
          style={inputStyle}
          placeholder="Observaciones adicionales..."
        />
      </Field>

      <div className="flex justify-end gap-3 mt-1">
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" loading={loading}>Crear solicitud</Button>
      </div>
    </form>
  );
}

// ── Administrative leave form ─────────────────────────────────────────────────

interface AdminFormProps {
  tipos: TipoLicencia[];
  saldos: SaldoLicencia[];
  onClose: () => void;
  onCreated: () => void;
}

function AdminLeaveForm({ tipos, saldos, onClose, onCreated }: AdminFormProps) {
  const tiposAdmin = tipos.filter((t) => !t.es_medica);

  const [form, setForm] = useState<NuevaSolicitud>({
    tipo_licencia_id: tiposAdmin[0]?.id ?? "",
    fecha_inicio: "",
    fecha_fin: "",
    comentario: "",
  });
  const [adjunto, setAdjunto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const tipoSeleccionado = tiposAdmin.find((t) => t.id === form.tipo_licencia_id);
  const saldoDisponible = saldos.find((s) => s.tipo_licencia_id === form.tipo_licencia_id);

  const diasSolicitados =
    form.fecha_inicio && form.fecha_fin
      ? Math.max(0, Math.round(
          (new Date(form.fecha_fin).getTime() - new Date(form.fecha_inicio).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1)
      : 0;

  const retornoLaboral = form.fecha_fin
    ? (() => {
        const d = new Date(form.fecha_fin);
        d.setDate(d.getDate() + 1);
        return d;
      })()
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const solicitud = await licenciasService.crear(form);
      if (adjunto) {
        await licenciasService.subirDocumento(solicitud.id, adjunto);
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear solicitud");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      <Field label="Tipo de licencia" required>
        <select
          required
          value={form.tipo_licencia_id}
          onChange={(e) => set("tipo_licencia_id", e.target.value)}
          className={inputCls}
          style={inputStyle}
        >
          {tiposAdmin.map((t) => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
      </Field>

      {saldoDisponible && (
        <p className="text-xs -mt-2" style={{ color: "var(--color-content-secondary)" }}>
          Saldo disponible: <strong>{saldoDisponible.dias_disponibles} días</strong>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Desde" required>
          <input
            type="date"
            required
            value={form.fecha_inicio}
            onChange={(e) => set("fecha_inicio", e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        </Field>
        <Field label="Hasta" required>
          <input
            type="date"
            required
            min={form.fecha_inicio}
            value={form.fecha_fin}
            onChange={(e) => set("fecha_fin", e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        </Field>
      </div>

      {diasSolicitados > 0 && retornoLaboral && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs"
          style={{ background: "var(--color-surface-empty)", color: "var(--color-content-secondary)" }}
        >
          <Calendar size={13} />
          <span>
            {diasSolicitados} {diasSolicitados === 1 ? "día" : "días"} · Retorno al trabajo:{" "}
            <strong style={{ color: "var(--color-state-present)" }}>
              {retornoLaboral.toLocaleDateString("es-AR")}
            </strong>
          </span>
        </div>
      )}

      {/* Optional attachment */}
      <Field label="Adjunto (opcional)">
        <label
          className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors"
          style={{
            borderColor: adjunto ? "var(--color-state-present)" : "var(--color-surface-border)",
            background: adjunto ? "#f0fdf4" : "var(--color-surface-card)",
            color: "var(--color-content-secondary)",
          }}
        >
          <input
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            className="sr-only"
            onChange={(e) => setAdjunto(e.target.files?.[0] ?? null)}
          />
          {adjunto ? (
            <>
              <FileText size={16} style={{ color: "var(--color-state-present)" }} />
              <span className="text-sm truncate" style={{ color: "var(--color-state-present)" }}>
                {adjunto.name}
              </span>
              <span className="text-xs ml-auto shrink-0">Cambiar</span>
            </>
          ) : (
            <>
              <Upload size={16} />
              <span className="text-sm">Adjuntar comprobante</span>
              <span className="text-xs ml-auto shrink-0">PDF, imagen · máx. 10 MB</span>
            </>
          )}
        </label>
      </Field>

      {tipoSeleccionado?.requiere_certificado && !adjunto && (
        <p
          className="text-xs rounded-lg px-3 py-2 -mt-2"
          style={{ background: "#fef0ee", color: "var(--color-state-absent)" }}
        >
          Este tipo de licencia requiere comprobante. Podés adjuntarlo ahora o después de crear la solicitud.
        </p>
      )}

      <Field label="Comentario (opcional)">
        <textarea
          rows={2}
          value={form.comentario}
          onChange={(e) => set("comentario", e.target.value)}
          className={`${inputCls} resize-none`}
          style={inputStyle}
          placeholder="Observaciones adicionales..."
        />
      </Field>

      <div className="flex justify-end gap-3 mt-1">
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" loading={loading}>Crear solicitud</Button>
      </div>
    </form>
  );
}

// ── Modal wrapper with type selector ─────────────────────────────────────────

interface NewLeaveModalProps {
  tipos: TipoLicencia[];
  saldos: SaldoLicencia[];
  onClose: () => void;
  onCreated: () => void;
}

function NewLeaveModal({ tipos, saldos, onClose, onCreated }: NewLeaveModalProps) {
  const [categoria, setCategoria] = useState<"medica" | "administrativa">("medica");

  const hasMedicos = tipos.some((t) => t.es_medica);
  const hasAdmin = tipos.some((t) => !t.es_medica);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-xl overflow-hidden"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--color-surface-border)" }}
        >
          <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>
            Nueva solicitud de licencia
          </h2>
          <button onClick={onClose} aria-label="Cerrar" style={{ color: "var(--color-content-secondary)" }}>
            <X size={18} />
          </button>
        </div>

        {/* Category selector */}
        <div
          className="flex gap-0 px-6 pt-4 pb-0"
        >
          {hasMedicos && (
            <button
              type="button"
              onClick={() => setCategoria("medica")}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-l-lg border transition-all"
              style={{
                borderColor: categoria === "medica" ? "var(--color-primary)" : "var(--color-surface-border)",
                background: categoria === "medica" ? "var(--color-primary)" : "var(--color-surface-card)",
                color: categoria === "medica" ? "#fff" : "var(--color-content-secondary)",
                borderRight: categoria === "medica" ? undefined : "none",
              }}
            >
              <Stethoscope size={15} />
              Licencia médica
            </button>
          )}
          {hasAdmin && (
            <button
              type="button"
              onClick={() => setCategoria("administrativa")}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-r-lg border transition-all"
              style={{
                borderColor: categoria === "administrativa" ? "var(--color-primary)" : "var(--color-surface-border)",
                background: categoria === "administrativa" ? "var(--color-primary)" : "var(--color-surface-card)",
                color: categoria === "administrativa" ? "#fff" : "var(--color-content-secondary)",
                borderLeft: categoria === "administrativa" ? undefined : "none",
              }}
            >
              <Briefcase size={15} />
              Licencia administrativa
            </button>
          )}
        </div>

        {/* Form body */}
        <div className="px-6 py-5 overflow-y-auto max-h-[70vh]">
          {categoria === "medica" && hasMedicos ? (
            <MedicalLeaveForm tipos={tipos} onClose={onClose} onCreated={onCreated} />
          ) : (
            <AdminLeaveForm tipos={tipos} saldos={saldos} onClose={onClose} onCreated={onCreated} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

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
                const esMedica = !!(sol.medico_nombre || sol.dias_reposo);
                return (
                  <div
                    key={sol.id}
                    className="rounded-xl border px-5 py-4"
                    style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {esMedica && <Stethoscope size={13} style={{ color: "var(--color-content-secondary)" }} />}
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
                          {sol.dias_reposo && ` · ${sol.dias_reposo} días según prescripción`}
                        </p>
                        {esMedica && sol.medico_nombre && (
                          <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
                            Dr. {sol.medico_nombre} {sol.medico_apellido}
                            {sol.medico_matricula && ` · Mat. ${sol.medico_matricula}`}
                          </p>
                        )}
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
