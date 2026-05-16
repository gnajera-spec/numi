import { apiClient } from "../lib/apiClient";
import type {
  PeriodoLiquidacion,
  CreatePeriodoRequest,
  UploadPreviewResponse,
  UploadConfirmResponse,
  ReciboDashboardItem,
  Paginated,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export const adminRecibosService = {
  listPeriodos: (params: { estado?: string; page?: number; page_size?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.estado) qs.set("estado", params.estado);
    qs.set("page", String(params.page ?? 1));
    qs.set("page_size", String(params.page_size ?? 20));
    return apiClient.get<Paginated<PeriodoLiquidacion>>(`/periodos?${qs}`);
  },

  createPeriodo: (data: CreatePeriodoRequest) =>
    apiClient.post<PeriodoLiquidacion>("/periodos", data),

  upload: async (periodoId: string, file: File): Promise<UploadPreviewResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("access_token");
    const res = await fetch(`${BASE_URL}/periodos/${periodoId}/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail ?? "Error al subir archivo");
    }
    return res.json();
  },

  confirmUpload: (periodoId: string, jobId: string) =>
    apiClient.post<UploadConfirmResponse>(
      `/periodos/${periodoId}/upload/${jobId}/confirm`,
      {}
    ),

  getRecibos: (periodoId: string, params: { page?: number; page_size?: number } = {}) => {
    const qs = new URLSearchParams();
    qs.set("page", String(params.page ?? 1));
    qs.set("page_size", String(params.page_size ?? 50));
    return apiClient.get<Paginated<ReciboDashboardItem>>(
      `/periodos/${periodoId}/recibos?${qs}`
    );
  },

  getExportUrl: (periodoId: string) =>
    `${BASE_URL}/recibos/export?periodo_id=${periodoId}`,

  downloadCsv: async (periodoId: string, filename: string) => {
    const token = localStorage.getItem("access_token") ?? "";
    const url = `${BASE_URL}/recibos/export?periodo_id=${periodoId}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error("Error al descargar CSV");
    const blob = await resp.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
  },

  // ── CUIL region config ──────────────────────────────────────────────────────

  getCuilConfig: () =>
    apiClient.get<CuilRegionConfig | null>("/recibos/cuil-config"),

  saveCuilConfig: (data: CuilRegionConfigUpdate) =>
    apiClient.put<CuilRegionConfig>("/recibos/cuil-config", data),

  uploadSamplePdf: async (file: File): Promise<{ sample_pdf_path: string; signed_url: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("access_token");
    const res = await fetch(`${BASE_URL}/recibos/cuil-config/sample`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail ?? "Error al subir PDF de ejemplo");
    }
    return res.json();
  },

  getSampleUrl: () =>
    apiClient.get<{ signed_url: string | null }>("/recibos/cuil-config/sample-url"),

  testCuilExtraction: () =>
    apiClient.post<CuilExtractionTestResult>("/recibos/cuil-config/test", {}),
};

export interface CuilRegionConfig {
  page_number: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  sample_pdf_path: string | null;
}

export interface CuilRegionConfigUpdate {
  page_number: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface CuilExtractionTestResult {
  cuil_extraido: string | null;
  texto_crudo: string | null;
  exito: boolean;
  detalle: string;
}
