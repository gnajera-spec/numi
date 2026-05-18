import { useEffect, useState, useCallback } from "react";
import { Activity, Clock } from "lucide-react";
import { MedicoLayout } from "../../../components/MedicoLayout";
import { Button } from "../../../components/Button";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { Spinner } from "../../../components/Spinner";
import { medicoService } from "../../../services/medicoService";
import type { ReporteAbsentismo, AptitudPorVencerItem } from "../../../types";

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

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border p-5 flex flex-col gap-1" style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-content-secondary)" }}>{label}</p>
      <p className="text-3xl font-bold" style={{ color: "var(--color-content-primary)" }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>{sub}</p>}
    </div>
  );
}

export function MedicoReportesPage() {
  const [desde, setDesde] = useState(monthStart());
  const [hasta, setHasta] = useState(today());
  const [diasVencer, setDiasVencer] = useState(30);
  const [reporte, setReporte] = useState<ReporteAbsentismo | null>(null);
  const [vencimiento, setVencimiento] = useState<AptitudPorVencerItem[]>([]);
  const [loadingR, setLoadingR] = useState(false);
  const [loadingV, setLoadingV] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReporte = useCallback(async () => {
    setLoadingR(true);
    setError(null);
    try {
      const res = await medicoService.reporteAbsentismo({ desde, hasta });
      setReporte(res.data);
    } catch {
      setError("No se pudo cargar el reporte de ausentismo.");
    } finally {
      setLoadingR(false);
    }
  }, [desde, hasta]);

  const loadVencimiento = useCallback(async () => {
    setLoadingV(true);
    try {
      const v = await medicoService.aptitudesPorVencer({ dias: diasVencer });
      setVencimiento(v);
    } catch {
      // Silently ignore — optional section
    } finally {
      setLoadingV(false);
    }
  }, [diasVencer]);

  useEffect(() => { loadReporte(); }, [loadReporte]);
  useEffect(() => { loadVencimiento(); }, [loadVencimiento]);

  const inputStyle = { borderColor: "var(--color-surface-border)", background: "var(--color-surface-card)", color: "var(--color-content-primary)" };

  return (
    <MedicoLayout>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-content-primary)" }}>Reportes</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
            Indicadores médicos y ausentismo
          </p>
        </div>

        {error && <ErrorBanner message={error} />}

        {/* ── Reporte ausentismo ──────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--color-content-primary)" }}>
              <Activity size={16} style={{ color: "#1a7a45" }} /> Ausentismo médico
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs" style={{ color: "var(--color-content-secondary)" }}>Desde</label>
              <input type="date" className="rounded-lg border px-2 py-1.5 text-sm" style={inputStyle} value={desde} onChange={e => setDesde(e.target.value)} />
              <label className="text-xs" style={{ color: "var(--color-content-secondary)" }}>Hasta</label>
              <input type="date" className="rounded-lg border px-2 py-1.5 text-sm" style={inputStyle} value={hasta} onChange={e => setHasta(e.target.value)} />
              <Button variant="secondary" onClick={loadReporte} disabled={loadingR}>Actualizar</Button>
            </div>
          </div>

          {loadingR ? (
            <div className="flex justify-center py-8"><Spinner size={24} /></div>
          ) : reporte ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard label="Total días ausentes" value={reporte.total_dias_ausentes} />
                <StatCard label="Tasa global" value={`${reporte.tasa_global_pct?.toFixed(1) ?? 0}%`} />
                <StatCard label="Departamentos" value={reporte.por_departamento?.length ?? 0} />
              </div>

              {reporte.por_departamento?.length > 0 && (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-card)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium uppercase tracking-wide"
                        style={{ borderBottom: "1px solid var(--color-surface-border)", color: "var(--color-content-secondary)", background: "var(--color-surface-app)" }}>
                        <th className="px-4 py-3">Departamento</th>
                        <th className="px-4 py-3 text-center">Colaboradores</th>
                        <th className="px-4 py-3 text-center">Días ausentes</th>
                        <th className="px-4 py-3 text-center">Tasa %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "var(--color-surface-border)" }}>
                      {reporte.por_departamento.map((row, i) => (
                        <tr key={i} className="hover:bg-[--color-surface-app] transition-colors">
                          <td className="px-4 py-3 font-medium" style={{ color: "var(--color-content-primary)" }}>{row.departamento}</td>
                          <td className="px-4 py-3 text-center" style={{ color: "var(--color-content-secondary)" }}>{row.colaboradores}</td>
                          <td className="px-4 py-3 text-center" style={{ color: "var(--color-content-secondary)" }}>{row.dias_ausentes}</td>
                          <td className="px-4 py-3 text-center" style={{ color: "var(--color-content-secondary)" }}>{row.tasa_pct?.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </section>

        {/* ── Aptitudes por vencer ────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--color-content-primary)" }}>
              <Clock size={16} style={{ color: "#ca8a04" }} /> Aptitudes por vencer
            </h2>
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: "var(--color-content-secondary)" }}>Próximos</label>
              <select
                className="rounded-lg border px-2 py-1.5 text-sm"
                style={inputStyle}
                value={diasVencer}
                onChange={e => setDiasVencer(Number(e.target.value))}
              >
                <option value={15}>15 días</option>
                <option value={30}>30 días</option>
                <option value={60}>60 días</option>
                <option value={90}>90 días</option>
              </select>
            </div>
          </div>

          {loadingV ? (
            <div className="flex justify-center py-8"><Spinner size={24} /></div>
          ) : vencimiento.length === 0 ? (
            <div className="rounded-xl border p-6 text-center text-sm" style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-card)", color: "var(--color-content-secondary)" }}>
              No hay aptitudes por vencer en los próximos {diasVencer} días.
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-card)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wide"
                    style={{ borderBottom: "1px solid var(--color-surface-border)", color: "var(--color-content-secondary)", background: "var(--color-surface-app)" }}>
                    <th className="px-4 py-3">Colaborador</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Puesto</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-center">Vence</th>
                    <th className="px-4 py-3 text-center">Días restantes</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--color-surface-border)" }}>
                  {vencimiento.map((item, i) => (
                    <tr key={i} className="hover:bg-[--color-surface-app] transition-colors">
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--color-content-primary)" }}>{item.nombre_completo}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-sm" style={{ color: "var(--color-content-secondary)" }}>{item.puesto}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--color-content-primary)" }}>{item.estado}</td>
                      <td className="px-4 py-3 text-center text-sm" style={{ color: "var(--color-content-secondary)" }}>{formatDate(item.fecha_vencimiento)}</td>
                      <td className="px-4 py-3 text-center">
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                          background: item.dias_restantes <= 7 ? "#fee2e2" : item.dias_restantes <= 15 ? "#fef9c3" : "#f3f4f6",
                          color: item.dias_restantes <= 7 ? "#991b1b" : item.dias_restantes <= 15 ? "#92400e" : "#6b7280",
                        }}>
                          {item.dias_restantes}d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </MedicoLayout>
  );
}
