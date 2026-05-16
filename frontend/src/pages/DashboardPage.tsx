import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FileText, Calendar, Bell, User, AlertCircle, ChevronRight } from "lucide-react";
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
  const location = useLocation();
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [recibosRes, comunicRes] = await Promise.allSettled([
          recibosService.list(1, 50),
          comunicacionesService.list(1, 50),
        ]);
        if (cancelled) return;
        const recibos: Recibo[]                   = recibosRes.status === "fulfilled" ? recibosRes.value.data  : [];
        const comunicaciones: ComunicacionColaborador[] = comunicRes.status === "fulfilled" ? comunicRes.value.items : [];
        setData({
          recibosPendientes:        recibos.filter(r => r.estado === "pendiente" || r.estado === "entregado").length,
          comunicacionesNoLeidas:   comunicaciones.filter(c => !c.leido_at).length,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [location.key]);

  const modules = [
    {
      to: "/employee/receipts",
      label: "Recibos de sueldo",
      description: "Descargá y firmá tus recibos",
      icon: FileText,
      badge: data?.recibosPendientes,
      color: "var(--color-state-absent)",
    },
    {
      to: "/employee/leaves",
      label: "Licencias",
      description: "Solicitá y consultá tus licencias",
      icon: Calendar,
      badge: null,
      color: "var(--color-primary)",
    },
    {
      to: "/employee/communications",
      label: "Comunicados",
      description: "Leé los comunicados de tu empresa",
      icon: Bell,
      badge: data?.comunicacionesNoLeidas,
      color: "var(--color-state-pending)",
    },
    {
      to: "/employee/profile",
      label: "Mi perfil",
      description: "Tus datos personales y contraseña",
      icon: User,
      badge: null,
      color: "var(--color-primary)",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1
          className="text-lg font-semibold"
          style={{ color: "var(--color-content-primary)", letterSpacing: "-0.01em" }}
        >
          Hola, {user?.first_name}
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
          {[user?.puesto_nombre, user?.departamento_nombre, user?.sede_nombre]
            .filter(Boolean).join(" · ")}
        </p>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <Spinner size={24} />
        </div>
      )}

      {!loading && (
        <>
          {/* Alert banner */}
          {(data?.recibosPendientes ?? 0) > 0 && (
            <div
              className="flex items-center gap-3 rounded-xl border px-4 py-3 mb-5 text-xs"
              style={{ background: "#fef0ee", borderColor: "var(--color-state-absent)" }}
            >
              <AlertCircle size={14} style={{ color: "var(--color-state-absent)", flexShrink: 0 }} />
              <span style={{ color: "var(--color-content-primary)" }}>
                Tenés <strong>{data!.recibosPendientes}</strong>{" "}
                {data!.recibosPendientes === 1 ? "recibo pendiente" : "recibos pendientes"} de firma.
              </span>
              <Link
                to="/employee/receipts"
                className="ml-auto font-semibold"
                style={{ color: "var(--color-state-absent)", whiteSpace: "nowrap" }}
              >
                Ver →
              </Link>
            </div>
          )}

          {/* Module grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {modules.map(({ to, label, description, icon: Icon, badge, color }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-shadow hover:shadow-md group"
                style={{
                  background: "var(--color-surface-card)",
                  borderColor: "var(--color-surface-border)",
                  textDecoration: "none",
                }}
              >
                {/* Icon chip */}
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `color-mix(in srgb, ${color} 10%, transparent)` }}
                >
                  <Icon size={17} style={{ color }} />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-semibold text-sm leading-tight"
                      style={{ color: "var(--color-content-primary)" }}
                    >
                      {label}
                    </span>
                    {badge != null && badge > 0 && (
                      <span
                        className="inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white min-w-[18px] h-[18px]"
                        style={{ background: color }}
                      >
                        {badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
                    {description}
                  </p>
                </div>

                <ChevronRight
                  size={14}
                  style={{ color: "var(--color-content-secondary)", flexShrink: 0, opacity: 0.5 }}
                  className="group-hover:opacity-100 transition-opacity"
                />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
