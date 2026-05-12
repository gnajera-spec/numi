import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Calendar, Bell, User, AlertCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { recibosService } from "../services/recibosService";
import { comunicacionesService } from "../services/comunicacionesService";
import { Spinner } from "../components/Spinner";
import type { Recibo, ComunicacionColaborador } from "../types";

interface DashboardData {
  recibosPendientes: number;
  comunicacionesNoLeidas: number;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [recibosRes, comunicRes] = await Promise.allSettled([
          recibosService.list(1, 50),
          comunicacionesService.list(1, 50),
        ]);

        const recibos: Recibo[] =
          recibosRes.status === "fulfilled" ? recibosRes.value.data : [];
        const comunicaciones: ComunicacionColaborador[] =
          comunicRes.status === "fulfilled" ? comunicRes.value.data : [];

        setData({
          recibosPendientes: recibos.filter(
            (r) => r.estado === "pendiente" || r.estado === "entregado"
          ).length,
          comunicacionesNoLeidas: comunicaciones.filter((c) => !c.leido_at).length,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const modules = [
    {
      to: "/employee/receipts",
      label: "Recibos de sueldo",
      description: "Descargá y firmá tus recibos",
      icon: FileText,
      badge: data?.recibosPendientes,
      badgeColor: "var(--color-state-absent)",
    },
    {
      to: "/employee/leaves",
      label: "Licencias",
      description: "Solicitá y consultá tus licencias",
      icon: Calendar,
      badge: null,
      badgeColor: null,
    },
    {
      to: "/employee/communications",
      label: "Comunicados",
      description: "Leé los comunicados de tu empresa",
      icon: Bell,
      badge: data?.comunicacionesNoLeidas,
      badgeColor: "var(--color-state-pending)",
    },
    {
      to: "/employee/profile",
      label: "Mi perfil",
      description: "Tus datos personales y contraseña",
      icon: User,
      badge: null,
      badgeColor: null,
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold" style={{ color: "var(--color-content-primary)" }}>
          Hola, {user?.first_name}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-content-secondary)" }}>
          {user?.puesto_nombre && `${user.puesto_nombre} · `}
          {user?.departamento_nombre && `${user.departamento_nombre} · `}
          {user?.sede_nombre}
        </p>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Spinner size={28} />
        </div>
      )}

      {!loading && (
        <>
          {(data?.recibosPendientes ?? 0) > 0 && (
            <div
              className="flex items-center gap-3 rounded-lg border px-4 py-3 mb-6 text-sm"
              style={{ background: "#fef0ee", borderColor: "var(--color-state-absent)" }}
            >
              <AlertCircle size={16} style={{ color: "var(--color-state-absent)" }} />
              <span>
                Tenés{" "}
                <strong>{data!.recibosPendientes}</strong>{" "}
                {data!.recibosPendientes === 1 ? "recibo pendiente" : "recibos pendientes"} de firma.
              </span>
              <Link
                to="/employee/receipts"
                className="ml-auto font-semibold text-sm"
                style={{ color: "var(--color-state-absent)" }}
              >
                Ver →
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {modules.map(({ to, label, description, icon: Icon, badge, badgeColor }) => (
              <Link
                key={to}
                to={to}
                className="flex items-start gap-4 rounded-xl border p-5 transition-shadow hover:shadow-md"
                style={{
                  background: "var(--color-surface-card)",
                  borderColor: "var(--color-surface-border)",
                }}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "var(--color-primary-light)" }}
                >
                  <Icon size={20} style={{ color: "var(--color-primary)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm" style={{ color: "var(--color-content-primary)" }}>
                      {label}
                    </span>
                    {badge != null && badge > 0 && (
                      <span
                        className="inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold text-white min-w-[20px]"
                        style={{ background: badgeColor ?? "var(--color-state-absent)" }}
                      >
                        {badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
                    {description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
