import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { TendenciaMes } from "../types";

interface TrendChartProps {
  data: TendenciaMes[];
}

export function TrendChart({ data }: TrendChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-48 rounded-lg border"
        style={{
          background: "var(--color-surface-empty)",
          borderColor: "var(--color-surface-border)",
          color: "var(--color-content-disabled)",
        }}
      >
        Sin datos para el período seleccionado
      </div>
    );
  }

  // Format mes "2026-04" → "Abr 26"
  const formatted = data.map((d) => {
    const [year, month] = d.mes.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const label = date.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
    return { ...d, label };
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={formatted} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-border)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: "var(--color-content-secondary)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: "var(--color-content-secondary)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-surface-card)",
            border: "1px solid var(--color-surface-border)",
            borderRadius: 8,
            fontSize: 13,
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value) => {
            const labels: Record<string, string> = {
              aprobadas: "Aprobadas",
              rechazadas: "Rechazadas",
              pendientes: "Pendientes",
            };
            return labels[value] ?? value;
          }}
        />
        <Bar dataKey="aprobadas" fill="var(--color-state-present)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="rechazadas" fill="var(--color-state-absent)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="pendientes" fill="var(--color-state-pending)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
