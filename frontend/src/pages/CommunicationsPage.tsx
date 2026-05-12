import { useEffect, useState, useCallback } from "react";
import { Bell, Paperclip, Check, X } from "lucide-react";
import { comunicacionesService } from "../services/comunicacionesService";
import { EmptyState } from "../components/EmptyState";
import { ErrorBanner } from "../components/ErrorBanner";
import { Spinner } from "../components/Spinner";
import { Button } from "../components/Button";
import type { ComunicacionColaborador } from "../types";

type FilterType = "todas" | "no_leidas" | "confirmadas";

const filters: { key: FilterType; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "no_leidas", label: "No leídas" },
  { key: "confirmadas", label: "Confirmadas" },
];

function DetailModal({
  com,
  onClose,
  onConfirmed,
}: {
  com: ComunicacionColaborador;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    setLoading(true);
    try {
      await comunicacionesService.confirmar(com.id);
      onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al confirmar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-xl border"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)", maxHeight: "80vh", display: "flex", flexDirection: "column" }}
      >
        <div className="flex items-start justify-between p-6 border-b" style={{ borderColor: "var(--color-surface-border)" }}>
          <h2 className="text-base font-semibold pr-4" style={{ color: "var(--color-content-primary)" }}>
            {com.titulo}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="shrink-0">
            <X size={18} style={{ color: "var(--color-content-secondary)" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

          <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--color-content-primary)" }}>
            {com.cuerpo}
          </p>

          {com.adjuntos.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-content-secondary)" }}>
                Adjuntos
              </p>
              <div className="flex flex-col gap-2">
                {com.adjuntos.map((adj) => (
                  <a
                    key={adj.id}
                    href={adj.signed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-medium hover:underline"
                    style={{ color: "var(--color-primary)" }}
                  >
                    <Paperclip size={14} />
                    {adj.nombre_archivo}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {com.requiere_confirmacion && !com.confirmado_at && (
          <div className="p-6 border-t flex justify-end" style={{ borderColor: "var(--color-surface-border)" }}>
            <Button onClick={handleConfirm} loading={loading}>
              <Check size={14} /> Confirmar lectura
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CommunicationsPage() {
  const [comunicaciones, setComunicaciones] = useState<ComunicacionColaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("todas");
  const [selected, setSelected] = useState<ComunicacionColaborador | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await comunicacionesService.list(1, 50);
      setComunicaciones(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar comunicados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = comunicaciones.filter((c) => {
    if (filter === "no_leidas") return !c.leido_at;
    if (filter === "confirmadas") return !!c.confirmado_at;
    return true;
  });

  const handleConfirmed = () => {
    setSelected(null);
    load();
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Bell size={22} style={{ color: "var(--color-primary)" }} />
        <h1 className="text-[22px] font-bold" style={{ color: "var(--color-content-primary)" }}>
          Comunicados
        </h1>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium border transition-colors"
            style={{
              background: filter === key ? "var(--color-primary)" : "transparent",
              color: filter === key ? "#fff" : "var(--color-content-secondary)",
              borderColor: filter === key ? "var(--color-primary)" : "var(--color-surface-border)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onRetry={load} /></div>}

      {loading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}

      {!loading && filtered.length === 0 && (
        <EmptyState
          icon={Bell}
          title="Sin comunicados"
          description={
            filter === "no_leidas"
              ? "Ya leíste todos los comunicados."
              : "Todavía no hay comunicados para vos."
          }
        />
      )}

      {!loading && filtered.length > 0 && (
        <div className="flex flex-col gap-3">
          {filtered.map((com) => (
            <button
              key={com.id}
              onClick={() => setSelected(com)}
              className="w-full text-left rounded-xl border px-5 py-4 transition-shadow hover:shadow-md"
              style={{
                background: "var(--color-surface-card)",
                borderColor: com.leido_at ? "var(--color-surface-border)" : "var(--color-primary)",
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: "var(--color-content-primary)" }}>
                      {com.titulo}
                    </span>
                    {!com.leido_at && (
                      <span
                        className="text-xs font-bold rounded-full px-2 py-0.5 text-white"
                        style={{ background: "var(--color-primary)" }}
                      >
                        NUEVA
                      </span>
                    )}
                    {com.requiere_confirmacion && !com.confirmado_at && (
                      <span
                        className="text-xs font-bold rounded-full px-2 py-0.5 text-white"
                        style={{ background: "var(--color-state-pending)" }}
                      >
                        Requiere confirmación
                      </span>
                    )}
                    {com.confirmado_at && (
                      <span
                        className="flex items-center gap-1 text-xs font-medium"
                        style={{ color: "var(--color-state-present)" }}
                      >
                        <Check size={12} /> Confirmada
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--color-content-secondary)" }}>
                    {com.cuerpo}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--color-content-disabled)" }}>
                    {new Date(com.created_at).toLocaleDateString("es-AR")}
                  </p>
                </div>
                {com.adjuntos.length > 0 && (
                  <Paperclip size={14} style={{ color: "var(--color-content-disabled)", flexShrink: 0, marginTop: 2 }} />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <DetailModal com={selected} onClose={() => setSelected(null)} onConfirmed={handleConfirmed} />
      )}
    </div>
  );
}
