import { useEffect, useState, useCallback } from "react";
import { FileText, CheckCircle, Clock, Download, PenLine } from "lucide-react";
import { recibosService } from "../services/recibosService";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { ErrorBanner } from "../components/ErrorBanner";
import { Spinner } from "../components/Spinner";
import type { Recibo, EstadoRecibo } from "../types";

const estadoBadge: Record<EstadoRecibo, { label: string; color: string; bg: string }> = {
  pendiente: { label: "Pendiente", color: "#fff", bg: "var(--color-state-pending)" },
  entregado: { label: "Entregado", color: "#fff", bg: "var(--color-state-pending)" },
  firmado: { label: "Firmado", color: "#fff", bg: "var(--color-state-present)" },
  vencido: { label: "Vencido", color: "#fff", bg: "var(--color-state-absent)" },
};

interface SignModalProps {
  reciboId: string;
  periodo: string;
  onClose: () => void;
  onSigned: () => void;
}

function SignModal({ reciboId, periodo, onClose, onSigned }: SignModalProps) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSign = async () => {
    setError(null);
    setLoading(true);
    try {
      await recibosService.firmar(reciboId);
      onSigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al firmar");
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
        className="w-full max-w-md rounded-xl border p-6"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-surface-border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: "var(--color-content-primary)" }}>
            Firmar recibo — {periodo}
          </h2>
          <button onClick={onClose} className="text-xl leading-none" aria-label="Cerrar">
            ×
          </button>
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

        <p className="text-sm mb-6" style={{ color: "var(--color-content-secondary)" }}>
          Al firmar electrónicamente, confirmás haber recibido y leído el recibo de sueldo correspondiente
          al período <strong>{periodo}</strong>. Esta acción queda registrada con timestamp UTC, hash
          SHA-256 e identificador de sesión.
        </p>

        <label className="flex items-start gap-3 cursor-pointer mb-6">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span className="text-sm" style={{ color: "var(--color-content-primary)" }}>
            He leído y estoy de acuerdo con el contenido del recibo
          </span>
        </label>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSign} loading={loading} disabled={!agreed}>
            Firmar electrónicamente
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ReceiptsPage() {
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingRecibo, setSigningRecibo] = useState<Recibo | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await recibosService.list();
      setRecibos(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar recibos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDownload = async (recibo: Recibo) => {
    try {
      const detail = await recibosService.get(recibo.id);
      window.open(detail.signed_url, "_blank");
    } catch {
      // silencioso — el usuario verá el comportamiento
    }
  };

  const handleSigned = () => {
    setSigningRecibo(null);
    load();
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <FileText size={22} style={{ color: "var(--color-primary)" }} />
        <h1 className="text-[22px] font-bold" style={{ color: "var(--color-content-primary)" }}>
          Mis recibos
        </h1>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onRetry={load} /></div>}

      {loading && (
        <div className="flex justify-center py-12"><Spinner size={28} /></div>
      )}

      {!loading && recibos.length === 0 && (
        <EmptyState
          icon={FileText}
          title="Sin recibos aún"
          description="Cuando RR.HH. suba tu primer recibo de sueldo, vas a verlo acá."
        />
      )}

      {!loading && recibos.length > 0 && (
        <div className="flex flex-col gap-3">
          {recibos.map((recibo) => {
            const badge = estadoBadge[recibo.estado];
            const canSign = recibo.estado === "pendiente" || recibo.estado === "entregado";
            return (
              <div
                key={recibo.id}
                className="flex items-center gap-4 rounded-xl border px-5 py-4"
                style={{
                  background: "var(--color-surface-card)",
                  borderColor: "var(--color-surface-border)",
                }}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "var(--color-primary-light)" }}
                >
                  {recibo.estado === "firmado" ? (
                    <CheckCircle size={20} style={{ color: "var(--color-state-present)" }} />
                  ) : (
                    <Clock size={20} style={{ color: "var(--color-state-pending)" }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm" style={{ color: "var(--color-content-primary)" }}>
                    {recibo.periodo_nombre}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
                    {recibo.firmado_at
                      ? `Firmado ${new Date(recibo.firmado_at).toLocaleDateString("es-AR")}`
                      : "Pendiente de firma"}
                  </p>
                </div>
                <span
                  className="text-xs font-semibold rounded-full px-2.5 py-1 shrink-0 border"
                  style={{
                    color: badge.bg === "var(--color-surface-empty)" ? "var(--color-content-secondary)" : badge.bg,
                    borderColor: badge.bg === "var(--color-surface-empty)" ? "var(--color-surface-border)" : badge.bg,
                    background: "transparent",
                  }}
                >
                  {badge.label}
                </span>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleDownload(recibo)}
                    className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--color-surface-empty)]"
                    style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-secondary)" }}
                    aria-label="Descargar PDF"
                  >
                    <Download size={14} />
                    <span className="hidden sm:inline">Descargar</span>
                  </button>
                  {canSign && (
                    <button
                      onClick={() => setSigningRecibo(recibo)}
                      className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
                      style={{ background: "var(--color-primary)" }}
                      aria-label="Firmar"
                    >
                      <PenLine size={14} />
                      <span className="hidden sm:inline">Firmar</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {signingRecibo && (
        <SignModal
          reciboId={signingRecibo.id}
          periodo={signingRecibo.periodo_nombre}
          onClose={() => setSigningRecibo(null)}
          onSigned={handleSigned}
        />
      )}
    </div>
  );
}
