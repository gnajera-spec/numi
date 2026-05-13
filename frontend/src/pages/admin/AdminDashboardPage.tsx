import { useEffect, useState } from "react";
import {
  Users,
  CalendarCheck,
  Clock,
  AlertTriangle,
  FileText,
  MessageSquare,
} from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { KPICard } from "../../components/KPICard";
import { TrendChart } from "../../components/TrendChart";
import { ErrorBanner } from "../../components/ErrorBanner";
import { reportesService } from "../../services/reportesService";
import type { DashboardKPIs, TendenciaMes } from "../../types";

function KPIGridSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-24 rounded-lg border animate-pulse"
          style={{
            background: "var(--color-surface-empty)",
            borderColor: "var(--color-surface-border)",
          }}
        />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div
      className="h-64 rounded-lg border animate-pulse"
      style={{
        background: "var(--color-surface-empty)",
        borderColor: "var(--color-surface-border)",
      }}
    />
  );
}

export function AdminDashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [tendencia, setTendencia] = useState<TendenciaMes[]>([]);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [errorKpis, setErrorKpis] = useState<string | null>(null);
  const [errorChart, setErrorChart] = useState<string | null>(null);

  const fetchKpis = async () => {
    setLoadingKpis(true);
    setErrorKpis(null);
    try {
      const data = await reportesService.getDashboard();
      setKpis(data);
    } catch (err) {
      setErrorKpis(err instanceof Error ? err.message : "Error al cargar KPIs");
    } finally {
      setLoadingKpis(false);
    }
  };

  const fetchTendencia = async () => {
    setLoadingChart(true);
    setErrorChart(null);
    try {
      const data = await reportesService.getTendenciaLicencias(6);
      setTendencia(data.tendencia);
    } catch (err) {
      setErrorChart(err instanceof Error ? err.message : "Error al cargar gráfico");
    } finally {
      setLoadingChart(false);
    }
  };

  useEffect(() => {
    fetchKpis();
    fetchTendencia();
  }, []);

  return (
    <AdminLayout>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-content-primary)" }}>
          Dashboard
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
          Resumen operativo del tenant
        </p>
      </div>

      {/* KPI Cards */}
      <section className="mb-8">
        {errorKpis && (
          <div className="mb-4">
            <ErrorBanner message={errorKpis} onRetry={fetchKpis} />
          </div>
        )}
        {loadingKpis ? (
          <KPIGridSkeleton />
        ) : kpis ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <KPICard
              icon={Users}
              value={kpis.headcount}
              label="Colaboradores activos"
              variant="neutral"
            />
            <KPICard
              icon={CalendarCheck}
              value={kpis.licencias_activas_hoy}
              label="Licencias activas hoy"
              variant="confirmed"
            />
            <KPICard
              icon={Clock}
              value={kpis.licencias_pendientes_aprobacion}
              label="Licencias pendientes aprobación"
              variant="pending"
            />
            <KPICard
              icon={AlertTriangle}
              value={kpis.vencimientos_proximos_30d}
              label="Vencimientos en 30 días"
              variant="absent"
            />
            <KPICard
              icon={FileText}
              value={kpis.recibos_sin_firmar}
              label="Recibos sin firmar"
              variant="pending"
            />
            <KPICard
              icon={MessageSquare}
              value={kpis.comunicados_sin_confirmar}
              label="Comunicados sin confirmar"
              variant="absent"
            />
          </div>
        ) : null}
      </section>

      {/* Tendencia licencias */}
      <section>
        <div
          className="rounded-lg border p-5"
          style={{
            background: "var(--color-surface-card)",
            borderColor: "var(--color-surface-border)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>
              Tendencia de licencias — últimos 6 meses
            </h2>
          </div>
          {errorChart && (
            <ErrorBanner message={errorChart} onRetry={fetchTendencia} />
          )}
          {loadingChart ? (
            <ChartSkeleton />
          ) : (
            <TrendChart data={tendencia} />
          )}
        </div>
      </section>
    </AdminLayout>
  );
}
