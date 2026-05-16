import { apiClient } from "../lib/apiClient";

const BASE_URL = (import.meta as unknown as { env: { VITE_API_URL?: string } }).env.VITE_API_URL ?? "";

async function uploadMultipart<T>(path: string, file: File, fieldName = "file"): Promise<T> {
  const token = localStorage.getItem("access_token");
  const fd = new FormData();
  fd.append(fieldName, file);
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (res.status === 401) {
    localStorage.removeItem("access_token");
    window.location.href = "/admin/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? "Error al subir archivo");
  }
  return res.json() as Promise<T>;
}
import type {
  ComunicacionAdmin,
  DestinatarioTracking,
  NuevaComunicacion,
  PaginatedItems,
} from "../types";

export const adminComunicacionesService = {
  list: (params: { estado?: string; page?: number; page_size?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.estado) qs.set("estado", params.estado);
    qs.set("page", String(params.page ?? 1));
    qs.set("page_size", String(params.page_size ?? 20));
    return apiClient.get<PaginatedItems<ComunicacionAdmin>>(`/comunicaciones?${qs}`);
  },

  create: (data: NuevaComunicacion) =>
    apiClient.post<ComunicacionAdmin>("/comunicaciones", data),

  get: (id: string) =>
    apiClient.get<ComunicacionAdmin>(`/comunicaciones/${id}`),

  enviar: (id: string) =>
    apiClient.post<{ estado: string; total_destinatarios: number }>(
      `/comunicaciones/${id}/enviar`,
      {}
    ),

  reenviar: (id: string) =>
    apiClient.post<{ reenviados: number }>(`/comunicaciones/${id}/reenviar`, {}),

  uploadAdjunto: (id: string, file: File) =>
    uploadMultipart<import("../types").AdjuntoComunicacion>(`/comunicaciones/${id}/adjuntos`, file),

  deleteAdjunto: (comId: string, adjuntoId: string) =>
    apiClient.delete<void>(`/comunicaciones/${comId}/adjuntos/${adjuntoId}`),

  getDestinatarios: (id: string) =>
    apiClient.get<DestinatarioTracking[]>(`/comunicaciones/${id}/destinatarios`),
};
