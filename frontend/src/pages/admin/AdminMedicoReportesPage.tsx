import { useEffect, useState, useCallback } from "react";
import { Activity, Clock } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Spinner } from "../../components/Spinner";
import { medicoService } from "../../services/medicoService";
import type { ReporteAbsentismo, AptitudPorVencerItem } from "../../types";

function today() {
  return new Date().toISOString().slice(0, 10);
}
function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-AR");
}

// ── Absentismo ─────────────────────────────────────────────────────────────────

function AbsentismoSection() {
  const [desde, setDesde] = useState(monthStart());
  const [hasta, setHasta] = useState(today());
  const [data, setData] = useState<ReporteAbsentismo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await medicoService.reporteAbsentismo({ desde, hasta });
      setData(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar reporte");
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => { load(); }, [load]);

  const inputCls = "rounded-lg border px-3 py-2 text-sm outline-none";
  const inputSty = { borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" };

  return (
    <div className="rounded-xl border p-5"
      style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}>
      <div className="flex items-center gap-2 mb-4">
        <Activity size={16} style={{ color: "var(--color-primary)" }} />
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-content-primary)" }}>Absentismo por departamento</h2>
      </div>

      {/* Filtros */}
      <div className="flex items-end gap-3 mb-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--color-content-secondary)" }}>Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={inputCls} style={inputSty} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--color-content-secondary)" }}>Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={inputCls} style={inputSty} />
        </div>
        <Button variant="secondary" onClick={load}>Actualizar</Button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : data ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: "Días ausentes totales", value: data.total_dias_ausentes },
              { label: "Tasa global", value: `${data.tasa_global_pct.toFixed(1)}%` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg p-3 text-center"
                style={{ background: "var(--color-surface-empty)" }}>
                <p className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{value}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Tabla por departamento */}
          {data.por_departamento.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: "var(--color-content-secondary)" }}>Sin datos para el período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-surface-border)" }}>
                    {["Departamento", "Colaboradores", "Días ausentes", "Tasa %"].map((h) => (
                      <th key={h} className="text-left pb-2 pr-4 font-medium text-xs"
                        style={{ color: "var(--color-content-secondary)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.por_departamento.map((row) => (
                    <tr key={row.departamento} style={{ borderBottom: "1px solid var(--color-surface-border)" }}>
                      <td className="py-2 pr-4" style={{ color: "var(--color-content-primary)" }}>{row.departamento}</td>
                      <td className="py-2 pr-4" style={{ color: "var(--color-content-secondary)" }}>{row.colaboradores}</td>
                      <td className="py-2 pr-4 font-medium" style={{ color: "var(--color-content-primary)" }}>{row.dias_ausentes}</td>
                      <td className="py-2">
                        <span className="font-semibold" style={{
                          color: row.tasa_pct > 10 ? "var(--color-state-absent)" :
                            row.tasa_pct > 5 ? "var(--color-state-pending)" : "var(--color-state-present)"
                        }}>
                          {row.tasa_pct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

// ── Aptitudes por vencer ───────────────────────────────────────────────────────

function AptitudVencimientoSection() {
  const [dias, setDias] = useState("30");
  const [items, setItems] = useState<AptitudPorVencerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await medicoService.aptitudesPorVencer({ dias: parseInt(dias) || 30 });
      setItems(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar vencimientos");
    } finally {
      setLoading(false);
    }
  }, [dias]);

  useEffect(() => { load(); }, [load]);

  const aptitudBadge: Record<string, string> = {
    apto: "var(--color-state-present)",
    apto_con_restricciones: "var(--color-state-pending)",
    no_apto: "var(--color-state-absent)",
  };

  const inputCls = "rounded-lg border px-3 py-2 text-sm outline-none";
  const inputSty = { borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" };

  return (
    <div className="rounded-xl border p-5"
      style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}>
      <div className="flex items-center gap-2 mb-4">
        <Clock size={16} style={{ color: "var(--color-primary)" }} />
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-content-primary)" }}>Aptitudes por vencer</h2>
      </div>

      <div className="flex items-end gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--color-content-secondary)" }}>Vencen en los próximos</label>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={365} value={dias} onChange={(e) => setDias(e.target.value)}
              className={inputCls + " w-20"} style={inputSty} />
            <span className="text-sm" style={{ color: "var(--color-content-secondary)" }}>días</span>
          </div>
        </div>
        <Button variant="secondary" onClick={load}>Actualizar</Button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: "var(--color-content-secondary)" }}>
          No hay aptitudes por vencer en los próximos {dias} días.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={`${item.user_id}-${item.fecha_vencimiento}`}
              className="rounded-lg border px-4 py-3 flex items-center justify-between"
              style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>{item.nombre_completo}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
                  {item.puesto} ·
                  <span style={{ color: aptitudBadge[item.estado] ?? "var(--color-content-secondary)" }}>
                    {" "}{item.estado.replace(/_/g, " ")}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold"
                  style={{ color: item.dias_restantes <= 7 ? "var(--color-state-absent)" : "var(--color-state-pending)" }}>
                  {item.dias_restantes}d
                </p>
                <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>{formatDate(item.fecha_vencimiento)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function AdminMedicoReportesPage() {
  return (
    <AdminLayout>
      <div>
        <div className="mb-6 flex items-center gap-3">
          <Activity size={22} style={{ color: "var(--color-primary)" }} />
          <h1 className="text-[22px] font-bold" style={{ color: "var(--color-content-primary)" }}>
            Reportes médicos
          </h1>
        </div>

        <div className="flex flex-col gap-5">
          <AbsentismoSection />
          <AptitudVencimientoSection />
        </div>
      </div>
    </AdminLayout>
  );
}
