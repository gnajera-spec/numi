/**
 * CuilRegionConfigurator
 *
 * Renders a sample PDF page and lets the user draw a bounding-box over the CUIL.
 * Coordinates are in PDF-point space (origin top-left, units = 1/72 inch).
 *
 * Flow:
 *  1. RRHH uploads a sample payslip PDF → signed URL is fetched and rendered via react-pdf
 *  2. User drags a rectangle over the CUIL area on the rendered page
 *  3. Coordinates are converted from canvas pixels back to PDF points
 *  4. User clicks "Guardar región" → PUT /recibos/cuil-config
 *  5. User clicks "Probar extracción" → POST /recibos/cuil-config/test
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  adminRecibosService,
  type CuilExtractionTestResult,
  type CuilRegionConfig,
} from "../services/adminRecibosService";
import { AlertTriangle, CheckCircle, XCircle, UploadCloud, ZoomIn, ZoomOut, MapPin, Pencil } from "lucide-react";
import { Button } from "./Button";

// Use the bundled worker from the installed package
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface Rect {
  x0: number; y0: number;
  x1: number; y1: number;
}

interface Props {
  initialConfig: CuilRegionConfig | null;
  onSaved: (cfg: CuilRegionConfig) => void;
}

// pdf.js renders at 1pt = 1CSS px at scale=1 (72dpi), so the conversion factor is 1.
const PT_TO_PX = 1;

export default function CuilRegionConfigurator({ initialConfig, onSaved }: Props) {
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scale, setScale] = useState(1.2);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  // Selection in PDF-point coords
  const [region, setRegion] = useState<Rect | null>(
    initialConfig
      ? { x0: initialConfig.x0, y0: initialConfig.y0, x1: initialConfig.x1, y1: initialConfig.y1 }
      : null
  );
  // Mouse drag state in px (canvas-relative)
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [dragRect, setDragRect] = useState<Rect | null>(null); // px, used only during drag
  const overlayRef = useRef<HTMLDivElement>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<CuilExtractionTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [savedConfig, setSavedConfig] = useState<CuilRegionConfig | null>(initialConfig);
  const [editing, setEditing] = useState(!initialConfig);

  // Load sample URL on mount
  useEffect(() => {
    adminRecibosService.getSampleUrl().then((r) => {
      if (r.signed_url) setSampleUrl(r.signed_url);
    }).catch(() => {});
  }, []);

  const handleUploadSample = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await adminRecibosService.uploadSamplePdf(file);
      setSampleUrl(res.signed_url);
      setRegion(null);
      setTestResult(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al subir PDF");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }, []);

  // Convert px (overlay-relative) → PDF points
  const pxToPt = useCallback((px: number, axis: "x" | "y"): number => {
    if (!pageSize) return px;
    const renderedSize = axis === "x"
      ? pageSize.width * scale * PT_TO_PX
      : pageSize.height * scale * PT_TO_PX;
    const ptSize = axis === "x" ? pageSize.width : pageSize.height;
    return (px / renderedSize) * ptSize;
  }, [pageSize, scale]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!pageSize || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    dragStart.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragRect(null);
    setTestResult(null);
    e.preventDefault();
  }, [pageSize]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStart.current || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setDragRect({
      x0: Math.min(dragStart.current.x, cx),
      y0: Math.min(dragStart.current.y, cy),
      x1: Math.max(dragStart.current.x, cx),
      y1: Math.max(dragStart.current.y, cy),
    });
  }, []);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStart.current || !overlayRef.current || !pageSize) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const pxX0 = Math.min(dragStart.current.x, cx);
    const pxY0 = Math.min(dragStart.current.y, cy);
    const pxX1 = Math.max(dragStart.current.x, cx);
    const pxY1 = Math.max(dragStart.current.y, cy);

    // Only accept regions with meaningful size (> 10px in each axis)
    if (pxX1 - pxX0 > 10 && pxY1 - pxY0 > 10) {
      setRegion({
        x0: pxToPt(pxX0, "x"),
        y0: pxToPt(pxY0, "y"),
        x1: pxToPt(pxX1, "x"),
        y1: pxToPt(pxY1, "y"),
      });
    }
    dragStart.current = null;
    setDragRect(null);
  }, [pageSize, pxToPt]);

  const handleSaveConfirmed = async () => {
    if (!region) return;
    setShowConfirmModal(false);
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await adminRecibosService.saveCuilConfig({
        page_number: 1,
        x0: region.x0, y0: region.y0,
        x1: region.x1, y1: region.y1,
      });
      setSavedConfig(saved);
      setEditing(false);
      onSaved(saved);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!region) return;
    setTesting(true);
    setTestResult(null);
    try {
      await adminRecibosService.saveCuilConfig({
        page_number: 1,
        x0: region.x0, y0: region.y0,
        x1: region.x1, y1: region.y1,
      });
      const result = await adminRecibosService.testCuilExtraction();
      setTestResult(result);
    } catch (err) {
      setTestResult({
        cuil_extraido: null,
        texto_crudo: null,
        exito: false,
        detalle: err instanceof Error ? err.message : "Error al probar extracción",
      });
    } finally {
      setTesting(false);
    }
  };

  // Compute overlay pixel rect from PDF-point region
  const overlayRect = region && pageSize ? {
    left:   (region.x0 / pageSize.width)  * pageSize.width  * scale * PT_TO_PX,
    top:    (region.y0 / pageSize.height) * pageSize.height * scale * PT_TO_PX,
    width:  ((region.x1 - region.x0) / pageSize.width)  * pageSize.width  * scale * PT_TO_PX,
    height: ((region.y1 - region.y0) / pageSize.height) * pageSize.height * scale * PT_TO_PX,
  } : null;

  // ── Vista de configuración guardada ──────────────────────────────────────
  if (!editing && savedConfig) {
    return (
      <div className="flex flex-col gap-4">
        {/* Estado activo */}
        <div
          className="rounded-xl border p-5 flex flex-col gap-4"
          style={{ borderColor: "var(--color-status-success)", background: "rgba(34,197,94,0.04)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-full p-2" style={{ background: "rgba(34,197,94,0.12)" }}>
                <CheckCircle size={20} className="text-green-500" />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--color-content-primary)" }}>
                  Configuración de CUIL activa
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-content-secondary)" }}>
                  La región está definida. El sistema usará esta posición para verificar el CUIL
                  en cada recibo antes de distribuirlo.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => { setEditing(true); setTestResult(null); setSaveError(null); }}
            >
              <Pencil size={14} />
              Modificar
            </Button>
          </div>

          {/* Detalles de la región */}
          <div
            className="rounded-lg border p-3 flex flex-col gap-2 text-xs"
            style={{ borderColor: "var(--color-surface-border)", background: "var(--color-surface-card)" }}
          >
            <div className="flex items-center gap-2" style={{ color: "var(--color-content-secondary)" }}>
              <MapPin size={13} className="shrink-0" />
              <span>
                Página {savedConfig.page_number} ·
                Región ({savedConfig.x0.toFixed(1)}, {savedConfig.y0.toFixed(1)}) →
                ({savedConfig.x1.toFixed(1)}, {savedConfig.y1.toFixed(1)}) pt
              </span>
            </div>
            {testResult?.exito && testResult.cuil_extraido && (
              <div className="flex items-center gap-2" style={{ color: "var(--color-content-secondary)" }}>
                <CheckCircle size={13} className="shrink-0 text-green-500" />
                <span>
                  Última extracción verificada: <span className="font-mono font-semibold" style={{ color: "var(--color-content-primary)" }}>{testResult.cuil_extraido}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Upload sample */}
      <div className="flex items-center gap-3">
        <label className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors cursor-pointer bg-transparent border border-[--color-surface-border] text-[--color-content-primary] hover:bg-[--color-surface-empty]">
          <UploadCloud size={16} />
          {uploading ? "Subiendo…" : "Subir PDF de ejemplo"}
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleUploadSample}
            disabled={uploading}
          />
        </label>
        <span className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
          Subí un recibo de sueldo real. El archivo se usa solo para definir la región del CUIL.
        </span>
      </div>

      {!sampleUrl && (
        <div
          className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-16 text-sm"
          style={{ borderColor: "var(--color-surface-border)", color: "var(--color-content-secondary)" }}
        >
          <UploadCloud size={32} className="mb-2 opacity-40" />
          Subí un PDF de ejemplo para empezar
        </div>
      )}

      {sampleUrl && (
        <>
          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: "var(--color-content-secondary)" }}>
              Zoom: {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
              className="rounded p-1.5 border border-[--color-surface-border] hover:bg-[--color-surface-empty] transition-colors"
              style={{ color: "var(--color-content-primary)" }}
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={() => setScale(s => Math.min(3, s + 0.1))}
              className="rounded p-1.5 border border-[--color-surface-border] hover:bg-[--color-surface-empty] transition-colors"
              style={{ color: "var(--color-content-primary)" }}
            >
              <ZoomIn size={14} />
            </button>
          </div>

          <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
            Arrastrá un rectángulo sobre el número de CUIL en el PDF para definir la región de extracción.
          </p>

          {/* PDF + selection overlay */}
          <div className="overflow-auto rounded-xl border" style={{ borderColor: "var(--color-surface-border)" }}>
            <div className="relative inline-block select-none">
              <Document
                file={sampleUrl}
                loading={<div className="p-8 text-sm" style={{ color: "var(--color-content-secondary)" }}>Cargando PDF…</div>}
                error={<div className="p-8 text-sm text-red-500">Error al cargar el PDF.</div>}
              >
                <Page
                  pageNumber={1}
                  scale={scale}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  onLoadSuccess={(page) =>
                    setPageSize({ width: page.originalWidth, height: page.originalHeight })
                  }
                />
              </Document>

              {/* Interaction overlay — sits on top of the rendered page */}
              <div
                ref={overlayRef}
                className="absolute inset-0 cursor-crosshair"
                style={{ zIndex: 10 }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={(e) => {
                  if (dragStart.current) onMouseUp(e);
                }}
              >
                {/* Saved region */}
                {overlayRect && !dragRect && (
                  <div
                    className="absolute border-2 pointer-events-none"
                    style={{
                      left: overlayRect.left,
                      top: overlayRect.top,
                      width: overlayRect.width,
                      height: overlayRect.height,
                      borderColor: "var(--color-brand-primary)",
                      background: "rgba(59,130,246,0.08)",
                    }}
                  >
                    <span
                      className="absolute -top-5 left-0 text-xs font-semibold px-1 rounded"
                      style={{
                        background: "var(--color-brand-primary)",
                        color: "#fff",
                      }}
                    >
                      CUIL
                    </span>
                  </div>
                )}

                {/* Live drag rect */}
                {dragRect && (
                  <div
                    className="absolute border-2 border-dashed pointer-events-none"
                    style={{
                      left: dragRect.x0,
                      top: dragRect.y0,
                      width: dragRect.x1 - dragRect.x0,
                      height: dragRect.y1 - dragRect.y0,
                      borderColor: "var(--color-brand-primary)",
                      background: "rgba(59,130,246,0.08)",
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      {region && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={handleTest}
            disabled={testing || !sampleUrl}
            loading={testing}
          >
            Probar extracción
          </Button>
          <span className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
            Región: ({region.x0.toFixed(1)}, {region.y0.toFixed(1)}) →
            ({region.x1.toFixed(1)}, {region.y1.toFixed(1)}) pt
          </span>
        </div>
      )}

      {saveError && (
        <p className="text-sm text-red-600">{saveError}</p>
      )}

      {/* Test result */}
      {testResult && (
        <div
          className="rounded-xl border p-4 text-sm flex flex-col gap-3"
          style={{
            borderColor: testResult.exito ? "var(--color-status-success)" : "var(--color-status-error)",
            background: testResult.exito ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
            color: "var(--color-content-primary)",
          }}
        >
          <div className="flex gap-3">
            {testResult.exito
              ? <CheckCircle size={20} className="shrink-0 text-green-500 mt-0.5" />
              : <XCircle size={20} className="shrink-0 text-red-500 mt-0.5" />
            }
            <div className="flex flex-col gap-1">
              <span className="font-semibold">{testResult.detalle}</span>
              {testResult.texto_crudo && (
                <span className="font-mono text-xs opacity-70">
                  Texto en región: &ldquo;{testResult.texto_crudo}&rdquo;
                </span>
              )}
            </div>
          </div>

          {testResult.exito && region && (
            <div className="flex justify-end pt-1">
              <Button
                variant="primary"
                onClick={() => setShowConfirmModal(true)}
                disabled={saving}
                loading={saving}
              >
                Guardar región
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Confirmation modal */}
      {showConfirmModal && region && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowConfirmModal(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl shadow-xl p-6 flex flex-col gap-5"
            style={{ background: "var(--color-surface-card)", color: "var(--color-content-primary)" }}
          >
            {/* Header */}
            <div className="flex items-start gap-3">
              <div
                className="shrink-0 rounded-full p-2"
                style={{ background: "rgba(245,158,11,0.12)" }}
              >
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Confirmar región del CUIL</h3>
                <p className="text-sm mt-1" style={{ color: "var(--color-content-secondary)" }}>
                  Esta configuración determina cómo se identifica a cada colaborador durante
                  la distribución de recibos de sueldo.
                </p>
              </div>
            </div>

            {/* Warning body */}
            <div
              className="rounded-xl p-4 text-sm flex flex-col gap-2"
              style={{
                background: "rgba(245,158,11,0.07)",
                borderLeft: "3px solid rgb(245,158,11)",
              }}
            >
              <p className="font-medium" style={{ color: "var(--color-content-primary)" }}>
                Verificá la información antes de confirmar
              </p>
              <p style={{ color: "var(--color-content-secondary)" }}>
                Los recibos de sueldo contienen información salarial confidencial. Una región
                incorrecta puede causar que un recibo se distribuya al colaborador equivocado
                o que no se distribuya en absoluto.
              </p>
            </div>

            {/* Test result summary if available */}
            {testResult?.exito && testResult.cuil_extraido && (
              <div
                className="rounded-xl border p-3 text-sm flex items-center gap-2"
                style={{
                  borderColor: "var(--color-status-success)",
                  background: "rgba(34,197,94,0.06)",
                }}
              >
                <CheckCircle size={16} className="shrink-0 text-green-500" />
                <span>
                  Extracción verificada: <span className="font-mono font-semibold">{testResult.cuil_extraido}</span>
                </span>
              </div>
            )}

            {!testResult?.exito && (
              <p className="text-xs" style={{ color: "var(--color-content-secondary)" }}>
                Tip: podés usar "Probar extracción" antes de confirmar para verificar que la región
                detecta el CUIL correctamente.
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-1">
              <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleSaveConfirmed}>
                Confirmar y guardar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
