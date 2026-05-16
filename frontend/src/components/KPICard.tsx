import type { LucideIcon } from "lucide-react";

type KPIVariant = "neutral" | "confirmed" | "present" | "absent" | "pending";

interface KPICardProps {
  icon: LucideIcon;
  value: number | string;
  label: string;
  variant?: KPIVariant;
}

const variantColors: Record<KPIVariant, string> = {
  neutral:   "var(--color-state-neutral)",
  confirmed: "var(--color-state-confirmed)",
  present:   "var(--color-state-present)",
  absent:    "var(--color-state-absent)",
  pending:   "var(--color-state-pending)",
};

export function KPICard({ icon: Icon, value, label, variant = "neutral" }: KPICardProps) {
  const color = variantColors[variant];
  return (
    <div
      className="flex items-center gap-3 p-4 rounded-xl border"
      style={{
        background: "var(--color-surface-card)",
        borderColor: "var(--color-surface-border)",
      }}
    >
      <div
        className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
        style={{ background: `color-mix(in srgb, ${color} 10%, transparent)` }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p
          className="text-2xl font-bold leading-none"
          style={{ color, fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </p>
        <p
          className="text-[11px] mt-1 leading-tight"
          style={{ color: "var(--color-content-secondary)" }}
        >
          {label}
        </p>
      </div>
    </div>
  );
}
