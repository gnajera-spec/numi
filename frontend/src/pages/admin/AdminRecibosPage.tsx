import { useEffect, useState, useCallback, useRef } from "react";
import { FileText, Plus, X, Upload, ChevronRight, Download, Settings } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Spinner } from "../../components/Spinner";
import CuilRegionConfigurator from "../../components/CuilRegionConfigurator";
import { adminRecibosService } from "../../services/adminRecibosService";
import type { CuilRegionConfig } from "../../services/adminRecibosService";
import type {
  PeriodoLiquidacion,
  CreatePeriodoRequest,
  UploadPreviewResponse,
  ReciboDashboardItem,
} from "../../types";
import { useAuth } from "../../contexts/AuthContext";

// ── Nuevo Período Modal ────────────────────────────────────────────────────

interface NuevoPeriodoModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function NuevoPeriodoModal({ onClose, onCreated }: NuevoPeriodoModalProps) {
  const [form, setForm] = useState<CreatePeriodoRequest>({
    periodo: "",
    descripcion: "",
    fecha_inicio: "",
    fecha_fin: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await adminRecibosService.createPeriodo(form);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear período");
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
            Nuevo período de liquidación
          </h2>
          <button onClick={onClose} aria-label="Cerrar">
            <X size={18} style={{ color: "var(--color-content-secondary)" }} />
          </button>
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="periodo" className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Período (YYYY-MM)
            </label>
            <input
              id="periodo"
              type="text"
              required
              pattern="\d{4}-\d{2}"
              value={form.periodo}
              onChange={(e) => setForm((f) => ({ ...f, periodo: e.target.value }))}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
              placeholder="Ej: 2026-05"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="descripcion" className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Descripción (opcional)
            </label>
            <input
              id="descripcion"
              type="text"
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
              placeholder="Ej: Sueldo mayo 2026"
            />
          </div>

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

          <div className="flex justify-end gap-3 mt-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              Crear período
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Upload Modal ────────────────────────────────────────────────────────────

interface UploadModalProps {
  periodo: PeriodoLiquidacion;
  onClose: () => void;
  onDone: () => void;
}

function UploadModal({ periodo, onClose, onDone }: UploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<UploadPreviewResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setPreview(null);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const data = await adminRecibosService.upload(periodo.id, file);
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir archivo");
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setConfirming(true);
    setError(null);
    try {
      await adminRecibosService.confirmUpload(periodo.id, preview.job_id);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al confirmar distribución");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-xl border p-6"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>
              Subir recibos
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
              {periodo.periodo} {periodo.descripcion ? `· ${periodo.descripcion}` : ""}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar">
            <X size={18} style={{ color: "var(--color-content-secondary)" }} />
          </button>
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

        {!preview ? (
          <div className="flex flex-col gap-4">
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-[var(--color-primary)]"
              style={{ borderColor: "var(--color-surface-border)" }}
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={32} className="mx-auto mb-2" style={{ color: "var(--color-content-disabled)" }} />
              {file ? (
                <p className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
                  {file.name}
                </p>
              ) : (
                <>
                  <p className="text-sm" style={{ color: "var(--color-content-primary)" }}>
                    Seleccionar PDF o ZIP
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--color-content-secondary)" }}>
                    PDF único o ZIP con múltiples recibos. Máx. 50MB
                  </p>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.zip"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" type="button" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleUpload} loading={uploading} disabled={!file}>
                <Upload size={15} />
                Subir y previsualizar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div
              className="rounded-lg p-3"
              style={{ background: "var(--color-surface-empty)", borderColor: "var(--color-surface-border)" }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-content-primary)" }}>
                {preview.total_archivos} archivo{preview.total_archivos !== 1 ? "s" : ""} detectado{preview.total_archivos !== 1 ? "s" : ""}
              </p>
              <div className="max-h-40 overflow-y-auto flex flex-col gap-1 mt-2">
                {preview.preview.map((item, i) => {
                  const rechazado = !item.user_id;
                  const motivoLabel =
                    item.rechazo_motivo === "cuil_no_extraible"
                      ? "CUIL no leído en la región configurada"
                      : item.rechazo_motivo === "cuil_sin_usuario"
                      ? "CUIL sin colaborador registrado"
                      : rechazado ? "sin usuario" : null;
                  return (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0 mt-1"
                        style={{ background: rechazado ? "var(--color-state-absent)" : "var(--color-state-present)" }}
                      />
                      <div className="flex flex-col">
                        <span style={{ color: "var(--color-content-primary)" }}>
                          {item.archivo}
                        </span>
                        {item.user_id ? (
                          <span style={{ color: "var(--color-content-secondary)" }}>
                            CUIL {item.cuil} — {item.nombre}
                          </span>
                        ) : (
                          <span style={{ color: "var(--color-state-absent)" }}>
                            {motivoLabel}
                            {item.cuil !== "no_extraible" && ` (${item.cuil})`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
              Los recibos en verde se distribuirán. Los rojos serán rechazados — no se envían si el CUIL
              no pudo leerse o no corresponde a ningún colaborador.
            </p>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" type="button" onClick={() => setPreview(null)}>
                Cambiar archivo
              </Button>
              <Button onClick={handleConfirm} loading={confirming}>
                Confirmar distribución
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Recibos de un período ───────────────────────────────────────────────────

interface PeriodoDetalleProps {
  periodo: PeriodoLiquidacion;
  onClose: () => void;
}

function PeriodoDetalle({ periodo, onClose }: PeriodoDetalleProps) {
  const [recibos, setRecibos] = useState<ReciboDashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await adminRecibosService.getRecibos(periodo.id);
        setRecibos(res.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar recibos");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [periodo.id]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await adminRecibosService.downloadCsv(periodo.id, `recibos-${periodo.periodo}.csv`);
    } catch {
      setError("Error al descargar CSV");
    } finally {
      setDownloading(false);
    }
  };

  const estadoColor: Record<string, string> = {
    firmado: "var(--color-state-present)",
    entregado: "var(--color-state-pending)",
    pendiente: "var(--color-content-secondary)",
    sin_recibo: "var(--color-state-absent)",
  };
  const estadoLabel: Record<string, string> = {
    firmado: "Firmado",
    entregado: "Entregado",
    pendiente: "Pendiente",
    sin_recibo: "Sin recibo",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-2xl rounded-xl border p-6 max-h-[90vh] flex flex-col"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>
              Recibos — {periodo.periodo}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
              {periodo.recibos_firmados}/{periodo.total_recibos} firmados
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50 disabled:opacity-50"
              style={{ color: "var(--color-content-secondary)", borderColor: "var(--color-surface-border)" }}
            >
              <Download size={13} />
              {downloading ? "Descargando..." : "CSV"}
            </button>
            <button onClick={onClose} aria-label="Cerrar">
              <X size={18} style={{ color: "var(--color-content-secondary)" }} />
            </button>
          </div>
        </div>

        {error && <div className="mb-3"><ErrorBanner message={error} /></div>}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : recibos.length === 0 ? (
            <EmptyState icon={FileText} title="Sin recibos" description="No se subieron recibos aún." />
          ) : (
            <div className="flex flex-col gap-2">
              {recibos.map((r) => (
                <div
                  key={r.user_id}
                  className="flex items-center justify-between px-4 py-2.5 rounded-lg border"
                  style={{ borderColor: "var(--color-surface-border)" }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
                      {r.full_name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                      CUIL {r.cuil} {r.legajo ? `· Leg. ${r.legajo}` : ""}
                    </p>
                  </div>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: estadoColor[r.estado] ?? "var(--color-content-secondary)" }}
                  >
                    {estadoLabel[r.estado] ?? r.estado}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────────────

type Tab = "periodos" | "configuracion";

export function AdminRecibosPage() {
  const { user } = useAuth();
  const canManage = user?.role === "admin_empresa" || user?.role === "super_admin" || user?.role === "rrhh";
  const [tab, setTab] = useState<Tab>("periodos");
  const [periodos, setPeriodos] = useState<PeriodoLiquidacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNuevoPeriodoModal, setShowNuevoPeriodoModal] = useState(false);
  const [uploadPeriodo, setUploadPeriodo] = useState<PeriodoLiquidacion | null>(null);
  const [detallePeriodo, setDetallePeriodo] = useState<PeriodoLiquidacion | null>(null);
  const [cuilConfig, setCuilConfig] = useState<CuilRegionConfig | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, cfg] = await Promise.all([
        adminRecibosService.listPeriodos({ page_size: 50 }),
        adminRecibosService.getCuilConfig().catch(() => null),
      ]);
      setPeriodos(res.data ?? []);
      setCuilConfig(cfg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar períodos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tabs = [
    { key: "periodos" as Tab, label: "Períodos", icon: FileText },
    { key: "configuracion" as Tab, label: "Configuración CUIL", icon: Settings },
  ];

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FileText size={22} style={{ color: "var(--color-primary)" }} />
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--color-content-primary)" }}>
              Recibos de sueldo
            </h1>
            <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
              Períodos, distribución y configuración
            </p>
          </div>
        </div>
        {tab === "periodos" && canManage && (
          <Button onClick={() => setShowNuevoPeriodoModal(true)}>
            <Plus size={16} />
            Nuevo período
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "var(--color-surface-border)" }}>
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
            style={{
              borderColor: tab === key ? "var(--color-brand-primary)" : "transparent",
              color: tab === key ? "var(--color-brand-primary)" : "var(--color-content-secondary)",
            }}
          >
            <Icon size={15} />
            {label}
            {key === "configuracion" && !cuilConfig && (
              <span
                className="ml-1 rounded-full px-1.5 py-0.5 text-xs font-bold"
                style={{ background: "var(--color-status-warning)", color: "#fff" }}
              >
                !
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Configuración tab */}
      {tab === "configuracion" && (
        <div
          className="rounded-xl border p-6"
          style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
        >
          <h2 className="text-base font-semibold mb-1" style={{ color: "var(--color-content-primary)" }}>
            Extracción de CUIL por región
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--color-content-secondary)" }}>
            Definí en qué parte del recibo se encuentra el CUIL. El sistema usará esta región para
            verificar que cada PDF corresponda al colaborador correcto antes de distribuirlo.
          </p>
          {!cuilConfig && (
            <div
              className="mb-4 rounded-lg border px-4 py-3 text-sm flex items-center gap-2"
              style={{
                background: "rgba(234,179,8,0.08)",
                borderColor: "var(--color-status-warning)",
                color: "var(--color-content-primary)",
              }}
            >
              <Settings size={16} className="shrink-0 text-yellow-500" />
              La configuración de región no está definida. No podrás subir recibos hasta completarla.
            </div>
          )}
          <CuilRegionConfigurator
            initialConfig={cuilConfig}
            onSaved={(cfg) => setCuilConfig(cfg)}
          />
        </div>
      )}

      {/* Períodos tab */}
      {tab === "periodos" && (
        <>
          {!cuilConfig && (
            <div
              className="mb-4 rounded-lg border px-4 py-3 text-sm flex items-center justify-between gap-3"
              style={{
                background: "rgba(234,179,8,0.08)",
                borderColor: "var(--color-status-warning)",
                color: "var(--color-content-primary)",
              }}
            >
              <span className="flex items-center gap-2">
                <Settings size={15} className="text-yellow-500 shrink-0" />
                Configurá la región del CUIL antes de subir recibos.
              </span>
              <button
                className="text-xs font-medium underline"
                style={{ color: "var(--color-brand-primary)" }}
                onClick={() => setTab("configuracion")}
              >
                Ir a Configuración
              </button>
            </div>
          )}
          {error && <div className="mb-4"><ErrorBanner message={error} onRetry={load} /></div>}
        </>
      )}

      {tab === "periodos" && loading ? (
        <div className="flex justify-center py-12"><Spinner size={28} /></div>
      ) : tab === "periodos" && periodos.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin períodos"
          description="Creá el primer período de liquidación."
          action={
            canManage ? (
              <Button variant="secondary" onClick={() => setShowNuevoPeriodoModal(true)}>
                <Plus size={14} /> Nuevo período
              </Button>
            ) : undefined
          }
        />
      ) : tab === "periodos" ? (
        <div className="flex flex-col gap-3">
          {periodos.map((p) => {
            const pct = p.total_recibos > 0
              ? Math.round((p.recibos_firmados / p.total_recibos) * 100)
              : 0;

            return (
              <div
                key={p.id}
                className="rounded-xl border px-5 py-4"
                style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-sm" style={{ color: "var(--color-content-primary)" }}>
                        {p.periodo}
                      </span>
                      {p.descripcion && (
                        <span className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                          {p.descripcion}
                        </span>
                      )}
                      <span
                        className="text-xs font-semibold rounded-full px-2.5 py-0.5 border"
                        style={{
                          color: p.estado === "abierto" ? "var(--color-primary)" : "var(--color-content-secondary)",
                          borderColor: p.estado === "abierto" ? "var(--color-primary)" : "var(--color-surface-border)",
                          background: "transparent",
                        }}
                      >
                        {p.estado === "abierto" ? "Abierto" : "Cerrado"}
                      </span>
                    </div>

                    {p.total_recibos > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-surface-border)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: "var(--color-state-present)" }}
                          />
                        </div>
                        <span className="text-xs shrink-0" style={{ color: "var(--color-content-secondary)" }}>
                          {p.recibos_firmados}/{p.total_recibos} firmados
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {canManage && (
                      <button
                        onClick={() => setUploadPeriodo(p)}
                        className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-blue-50"
                        style={{ color: "var(--color-primary)", borderColor: "var(--color-surface-border)" }}
                      >
                        <Upload size={13} />
                        Subir recibos
                      </button>
                    )}
                    <button
                      onClick={() => setDetallePeriodo(p)}
                      className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50"
                      style={{ color: "var(--color-content-secondary)", borderColor: "var(--color-surface-border)" }}
                    >
                      Ver detalle
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {showNuevoPeriodoModal && (
        <NuevoPeriodoModal
          onClose={() => setShowNuevoPeriodoModal(false)}
          onCreated={() => { setShowNuevoPeriodoModal(false); load(); }}
        />
      )}

      {uploadPeriodo && (
        <UploadModal
          periodo={uploadPeriodo}
          onClose={() => setUploadPeriodo(null)}
          onDone={() => { setUploadPeriodo(null); load(); }}
        />
      )}

      {detallePeriodo && (
        <PeriodoDetalle
          periodo={detallePeriodo}
          onClose={() => setDetallePeriodo(null)}
        />
      )}
    </AdminLayout>
  );
}
