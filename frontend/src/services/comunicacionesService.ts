import { apiClient } from "../lib/apiClient";
import type { ComunicacionColaborador, Paginated } from "../types";

export const comunicacionesService = {
  list: (page = 1, pageSize = 20) =>
    apiClient.get<Paginated<ComunicacionColaborador>>(
      `/comunicaciones/colaborador?page=${page}&page_size=${pageSize}`
    ),

  confirmar: (id: string) =>
    apiClient.post<{ ok: boolean }>(`/comunicaciones/${id}/confirmar`, {}),
};
