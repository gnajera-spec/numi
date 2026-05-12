import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-lg border p-10 text-center"
      style={{
        background: "var(--color-surface-empty)",
        borderColor: "var(--color-surface-border)",
        minHeight: 200,
      }}
    >
      <Icon size={48} style={{ color: "var(--color-content-disabled)" }} strokeWidth={1.5} />
      <p className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>
        {title}
      </p>
      <p className="text-sm max-w-xs" style={{ color: "var(--color-content-secondary)" }}>
        {description}
      </p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
