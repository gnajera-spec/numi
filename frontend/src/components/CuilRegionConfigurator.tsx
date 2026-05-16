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
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import {
  adminRecibosService,
  type CuilExtractionTestResult,
  type CuilRegionConfig,
} from "../services/adminRecibosService";
import { CheckCircle, XCircle, UploadCloud, ZoomIn, ZoomOut } from "lucide-react";

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

// Dimensions of one PDF point on screen at scale=1  (96dpi screen / 72pt/inch ≈ 1.333)
const PT_TO_PX = 96 / 72;

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

  const handleSave = async () => {
    if (!region) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await adminRecibosService.saveCuilConfig({
        page_number: 1,
        x0: region.x0, y0: region.y0,
        x1: region.x1, y1: region.y1,
      });
      onSaved(saved);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
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

  return (
    <div className="flex flex-col gap-6">
      {/* Upload sample */}
      <div className="flex items-center gap-3">
        <label
          className="flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-opacity-80"
          style={{
            borderColor: "var(--color-surface-border)",
            color: "var(--color-content-primary)",
            background: "var(--color-surface-card)",
          }}
        >
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
              className="rounded p-1 hover:bg-black/5"
            >
              <ZoomOut size={16} />
            </button>
            <button
              onClick={() => setScale(s => Math.min(3, s + 0.1))}
              className="rounded p-1 hover:bg-black/5"
            >
              <ZoomIn size={16} />
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
                  onLoadSuccess={(page) =>
                    setPageSize({ width: page.originalWidth, height: page.originalHeight })
                  }
                />
              </Document>

              {/* Interaction overlay — sits on top of the rendered page */}
              <div
                ref={overlayRef}
                className="absolute inset-0 cursor-crosshair"
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
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ background: "var(--color-brand-primary)" }}
          >
            {saving ? "Guardando…" : "Guardar región"}
          </button>
          <button
            onClick={handleTest}
            disabled={testing || !sampleUrl}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              borderColor: "var(--color-surface-border)",
              color: "var(--color-content-primary)",
              background: "var(--color-surface-card)",
            }}
          >
            {testing ? "Probando…" : "Probar extracción"}
          </button>
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
          className="rounded-xl border p-4 text-sm flex gap-3"
          style={{
            borderColor: testResult.exito ? "var(--color-status-success)" : "var(--color-status-error)",
            background: testResult.exito ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
            color: "var(--color-content-primary)",
          }}
        >
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
      )}
    </div>
  );
}
