import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "destructive";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[--color-primary] text-white hover:bg-[--color-primary-dark] disabled:opacity-50",
  secondary:
    "bg-transparent border border-[--color-surface-border] text-[--color-content-primary] hover:bg-[--color-surface-empty] disabled:opacity-50",
  destructive:
    "bg-[--color-state-absent] text-white hover:opacity-90 disabled:opacity-50",
};

export function Button({
  variant = "primary",
  loading = false,
  children,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {loading && <Spinner size={14} />}
      {loading ? "Cargando..." : children}
    </button>
  );
}
