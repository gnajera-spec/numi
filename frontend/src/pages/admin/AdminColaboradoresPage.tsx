import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Search, ChevronRight, Filter } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Spinner } from "../../components/Spinner";
import { Badge } from "../../components/Badge";
import { adminUsuariosService } from "../../services/adminUsuariosService";
import type { UserSummary, EstadoUsuario } from "../../types";

const estadoVariant: Record<EstadoUsuario, "success" | "warning" | "error" | "neutral"> = {
  activo:     "success",
  pendiente:  "warning",
  suspendido: "error",
  baja:       "neutral",
};
const estadoLabel: Record<EstadoUsuario, string> = {
  activo:     "Activo",
  pendiente:  "Pendiente",
  suspendido: "Suspendido",
  baja:       "De baja",
};

export function AdminColaboradoresPage() {
  const navigate = useNavigate();
  const [users, setUsers]       = useState<UserSummary[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [estado, setEstado]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminUsuariosService.list({
        role: "colaborador",
        search: debouncedSearch || undefined,
        estado: estado || undefined,
        page_size: 50,
      });
      setUsers(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar colaboradores");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, estado]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Users size={22} style={{ color: "var(--color-primary)" }} />
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--color-content-primary)" }}>
              Colaboradores
            </h1>
            <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
              Gestión de legajos laborales
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1" style={{ minWidth: 200, maxWidth: 340 }}>
          <Search size={14} style={{
            position: "absolute", left: 12, top: "50%",
            transform: "translateY(-50%)",
            color: "var(--color-content-secondary)", pointerEvents: "none",
          }} />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none"
            style={{
              borderColor: "var(--color-surface-border)",
              color: "var(--color-content-primary)",
              background: "var(--color-surface-card)",
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: "var(--color-content-secondary)" }} />
          <select
            value={estado}
            onChange={e => setEstado(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm outline-none"
            style={{
              borderColor: "var(--color-surface-border)",
              color: "var(--color-content-primary)",
              background: "var(--color-surface-card)",
            }}
          >
            <option value="">Todos los estados</option>
            <option value="activo">Activos</option>
            <option value="pendiente">Pendientes</option>
            <option value="suspendido">Suspendidos</option>
            <option value="baja">De baja</option>
          </select>
        </div>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onRetry={load} /></div>}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size={28} /></div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin colaboradores"
          description={
            debouncedSearch || estado
              ? "No hay colaboradores que coincidan con los filtros."
              : "Todavía no hay colaboradores registrados."
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => navigate(`/admin/colaboradores/${u.id}`)}
              className="w-full text-left rounded-xl border px-5 py-4 transition-colors"
              style={{
                background: "var(--color-surface-card)",
                borderColor: "var(--color-surface-border)",
                cursor: "pointer",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "var(--color-bg-hover)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "var(--color-surface-card)";
              }}
            >
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: "var(--color-primary-xlight)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700,
                  color: "var(--color-primary)",
                  letterSpacing: "0.5px",
                }}>
                  {u.first_name[0]}{u.last_name[0]}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: "var(--color-content-primary)" }}>
                      {u.full_name}
                    </span>
                    <Badge variant={estadoVariant[u.estado]} label={estadoLabel[u.estado]} />
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--color-content-secondary)" }}>
                    {u.email}
                    {u.legajo && <> · Leg. {u.legajo}</>}
                    {u.sede_nombre && <> · {u.sede_nombre}</>}
                    {u.departamento_nombre && <> · {u.departamento_nombre}</>}
                  </p>
                </div>

                <ChevronRight size={16} style={{ color: "var(--color-content-secondary)", flexShrink: 0 }} />
              </div>
            </button>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
