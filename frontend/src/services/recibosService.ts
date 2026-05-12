import { apiClient } from "../lib/apiClient";
import type { Recibo, ReciboDetalle, FirmaResponse, Paginated } from "../types";

export const recibosService = {
  list: (page = 1, pageSize = 20) =>
    apiClient.get<Paginated<Recibo>>(`/recibos?page=${page}&page_size=${pageSize}`),

  get: (id: string) => apiClient.get<ReciboDetalle>(`/recibos/${id}`),

  firmar: (id: string) =>
    apiClient.post<FirmaResponse>(`/recibos/${id}/firmar`, { canal: "portal" }),
};
