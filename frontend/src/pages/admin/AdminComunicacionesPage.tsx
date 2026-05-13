import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Plus, X, Send, RefreshCw } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Spinner } from "../../components/Spinner";
import { adminComunicacionesService } from "../../services/adminComunicacionesService";
import type { ComunicacionAdmin, NuevaComunicacion, EstadoComunicacion } from "../../types";

const estadoBadge: Record<EstadoComunicacion, { label: string; color: string; bg: string }> = {
  borrador: { label: "Borrador", color: "var(--color-content-secondary)", bg: "var(--color-surface-empty)" },
  enviada: { label: "Enviada", color: "#fff", bg: "var(--color-state-present)" },
  programada: { label: "Programada", color: "#fff", bg: "var(--color-state-pending)" },
};

const segmentoLabel: Record<NuevaComunicacion["tipo_segmento"], string> = {
  todos: "Todos los colaboradores",
  sede: "Por sede",
  departamento: "Por departamento",
  puesto: "Por puesto",
  lista_custom: "Lista personalizada",
};

interface NuevaComunicacionModalProps {
  onClose: () => void;
  onCreated: (com: ComunicacionAdmin) => void;
}

function NuevaComunicacionModal({ onClose, onCreated }: NuevaComunicacionModalProps) {
  const [form, setForm] = useState<NuevaComunicacion>({
    asunto: "",
    cuerpo: "",
    tipo_segmento: "todos",
    requiere_confirmacion: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const com = await adminComunicacionesService.create(form);
      onCreated(com);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear comunicación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-xl border p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>
            Nueva comunicación
          </h2>
          <button onClick={onClose} aria-label="Cerrar">
            <X size={18} style={{ color: "var(--color-content-secondary)" }} />
          </button>
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="asunto" className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Asunto
            </label>
            <input
              id="asunto"
              type="text"
              required
              maxLength={200}
              value={form.asunto}
              onChange={(e) => setForm((f) => ({ ...f, asunto: e.target.value }))}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
              placeholder="Ej: Comunicado sobre cambio de horario"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="cuerpo" className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Cuerpo
            </label>
            <textarea
              id="cuerpo"
              rows={5}
              required
              maxLength={5000}
              value={form.cuerpo}
              onChange={(e) => setForm((f) => ({ ...f, cuerpo: e.target.value }))}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none resize-none"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
              placeholder="Texto de la comunicación..."
            />
            <p className="text-xs text-right" style={{ color: "var(--color-content-secondary)" }}>
              {form.cuerpo.length}/5000
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="segmento" className="text-sm font-medium" style={{ color: "var(--color-content-primary)" }}>
              Destinatarios
            </label>
            <select
              id="segmento"
              value={form.tipo_segmento}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  tipo_segmento: e.target.value as NuevaComunicacion["tipo_segmento"],
                }))
              }
              className="rounded-lg border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-primary)" }}
            >
              {Object.entries(segmentoLabel).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.requiere_confirmacion}
              onChange={(e) => setForm((f) => ({ ...f, requiere_confirmacion: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm" style={{ color: "var(--color-content-primary)" }}>
              Requiere confirmación de lectura
            </span>
          </label>

          <div className="flex justify-end gap-3 mt-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              Crear borrador
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminComunicacionesPage() {
  const [comunicaciones, setComunicaciones] = useState<ComunicacionAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminComunicacionesService.list({ page_size: 50 });
      setComunicaciones(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar comunicaciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const enviar = async (id: string) => {
    setSendingId(id);
    try {
      await adminComunicacionesService.enviar(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setSendingId(null);
    }
  };

  const reenviar = async (id: string) => {
    setResendingId(id);
    try {
      await adminComunicacionesService.reenviar(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reenviar");
    } finally {
      setResendingId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <MessageSquare size={22} style={{ color: "var(--color-primary)" }} />
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--color-content-primary)" }}>
              Comunicaciones
            </h1>
            <p className="text-sm" style={{ color: "var(--color-content-secondary)" }}>
              Comunicados institucionales
            </p>
          </div>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} />
          Nueva comunicación
        </Button>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onRetry={load} /></div>}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size={28} /></div>
      ) : comunicaciones.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Sin comunicaciones"
          description="Creá el primer comunicado institucional."
          action={
            <Button variant="secondary" onClick={() => setShowModal(true)}>
              <Plus size={14} /> Nueva comunicación
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {comunicaciones.map((com) => {
            const badge = estadoBadge[com.estado];
            const isSending = sendingId === com.id;
            const isResending = resendingId === com.id;

            return (
              <div
                key={com.id}
                className="rounded-xl border px-5 py-4"
                style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm" style={{ color: "var(--color-content-primary)" }}>
                        {com.asunto}
                      </span>
                      <span
                        className="text-xs font-semibold rounded-full px-2.5 py-0.5"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs line-clamp-2" style={{ color: "var(--color-content-secondary)" }}>
                      {com.cuerpo}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs" style={{ color: "var(--color-content-secondary)" }}>
                      <span>{segmentoLabel[com.tipo_segmento]}</span>
                      {com.requiere_confirmacion && <span>· Requiere confirmación</span>}
                      {com.total_destinatarios !== undefined && (
                        <span>· {com.total_destinatarios} destinatarios</span>
                      )}
                      <span>· {new Date(com.created_at).toLocaleDateString("es-AR")}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {com.estado === "borrador" && (
                      <button
                        onClick={() => enviar(com.id)}
                        disabled={isSending}
                        className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-blue-50 disabled:opacity-50"
                        style={{ color: "var(--color-primary)", borderColor: "var(--color-surface-border)" }}
                      >
                        <Send size={13} />
                        {isSending ? "Enviando..." : "Enviar"}
                      </button>
                    )}
                    {com.estado === "enviada" && (
                      <button
                        onClick={() => reenviar(com.id)}
                        disabled={isResending}
                        className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50 disabled:opacity-50"
                        style={{ color: "var(--color-content-secondary)", borderColor: "var(--color-surface-border)" }}
                      >
                        <RefreshCw size={13} />
                        {isResending ? "Reenviando..." : "Reenviar"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <NuevaComunicacionModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
    </AdminLayout>
  );
}
