/**
 * Badge — outlined style matching NUMI design system.
 * Cada variante usa borde de color + texto de color, fondo transparente.
 */

type BadgeVariant =
  | "aprobada" | "aprobado" | "activo"
  | "pendiente"
  | "rechazada" | "no_aprobada" | "deshabilitado" | "suspendido" | "baja"
  | "auditoria"
  | "cancelada" | "neutral";

const variantClasses: Record<BadgeVariant, string> = {
  aprobada:      "badge-aprobada",
  aprobado:      "badge-aprobado",
  activo:        "badge-activo",
  pendiente:     "badge-pendiente",
  rechazada:     "badge-rechazada",
  no_aprobada:   "badge-no-aprobada",
  deshabilitado: "badge-deshabilitado",
  suspendido:    "badge-suspendido",
  baja:          "badge-baja",
  auditoria:     "badge-auditoria",
  cancelada:     "badge-cancelada",
  neutral:       "badge-neutral",
};

interface BadgeProps {
  variant: BadgeVariant;
  label: string;
  className?: string;
}

export function Badge({ variant, label, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ${variantClasses[variant]} ${className}`}
    >
      {label}
    </span>
  );
}

/** Helper: convierte estado string → variante Badge */
export function estadoToVariant(estado: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    aprobada: "aprobada",
    aprobado: "aprobado",
    activo: "activo",
    pendiente: "pendiente",
    rechazada: "rechazada",
    no_aprobada: "no_aprobada",
    cancelada: "cancelada",
    baja: "baja",
    suspendido: "suspendido",
    auditoria: "auditoria",
    deshabilitado: "deshabilitado",
    habilitado: "aprobado",
  };
  return map[estado.toLowerCase()] ?? "neutral";
}
