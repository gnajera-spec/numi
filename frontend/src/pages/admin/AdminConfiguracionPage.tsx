import { useNavigate } from "react-router-dom";
import { FileText, Mail, GitBranch, ChevronRight } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";

interface ConfigCard {
  title: string;
  description: string;
  icon: React.ElementType;
  to: string;
}

const cards: ConfigCard[] = [
  {
    title: "Tipos de licencias",
    description: "Definí los tipos de licencia disponibles, días máximos y si requieren certificado médico.",
    icon: FileText,
    to: "/admin/tipos-licencias",
  },
  {
    title: "Aprobaciones de licencias",
    description: "Configurá las etapas y reglas del flujo de aprobación de solicitudes.",
    icon: GitBranch,
    to: "/admin/configuracion/aprobaciones",
  },
  {
    title: "Configuración de email",
    description: "Servidor SMTP para el envío de notificaciones y comunicaciones a colaboradores.",
    icon: Mail,
    to: "/admin/configuracion/smtp",
  },
];

export function AdminConfiguracionPage() {
  const navigate = useNavigate();

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-content-primary)" }}>
            Configuración
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
            Ajustá los parámetros del sistema para tu organización
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {cards.map(({ title, description, icon: Icon, to }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="flex items-center gap-4 px-5 py-4 rounded-xl border text-left transition-all hover:shadow-sm group"
              style={{
                background: "var(--color-surface-card)",
                borderColor: "var(--color-surface-border)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-primary)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-surface-border)";
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "var(--color-primary-light)" }}
              >
                <Icon size={20} style={{ color: "var(--color-primary)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--color-content-primary)" }}>
                  {title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
                  {description}
                </p>
              </div>
              <ChevronRight size={16} style={{ color: "var(--color-content-secondary)" }} className="shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
