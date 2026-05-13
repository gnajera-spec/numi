import { apiClient } from "../lib/apiClient";
import type {
  ComunicacionAdmin,
  NuevaComunicacion,
  Paginated,
} from "../types";

export const adminComunicacionesService = {
  list: (params: { estado?: string; page?: number; page_size?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.estado) qs.set("estado", params.estado);
    qs.set("page", String(params.page ?? 1));
    qs.set("page_size", String(params.page_size ?? 20));
    return apiClient.get<Paginated<ComunicacionAdmin>>(`/comunicaciones?${qs}`);
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
};
