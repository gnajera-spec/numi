import type { LucideIcon } from "lucide-react";

type KPIVariant = "neutral" | "confirmed" | "present" | "absent" | "pending";

interface KPICardProps {
  icon: LucideIcon;
  value: number | string;
  label: string;
  variant?: KPIVariant;
}

const variantColors: Record<KPIVariant, string> = {
  neutral: "var(--color-state-neutral)",
  confirmed: "var(--color-state-confirmed)",
  present: "var(--color-state-present)",
  absent: "var(--color-state-absent)",
  pending: "var(--color-state-pending)",
};

export function KPICard({ icon: Icon, value, label, variant = "neutral" }: KPICardProps) {
  const color = variantColors[variant];
  return (
    <div
      className="flex items-center gap-4 p-5 rounded-lg border"
      style={{
        background: "var(--color-surface-card)",
        borderColor: "var(--color-surface-border)",
      }}
    >
      <div
        className="flex items-center justify-center w-11 h-11 rounded-lg shrink-0"
        style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}
      >
        <Icon size={22} style={{ color }} />
      </div>
      <div>
        <p className="text-3xl font-bold leading-none" style={{ color }}>
          {value}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--color-content-secondary)" }}>
          {label}
        </p>
      </div>
    </div>
  );
}
