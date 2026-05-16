import { apiClient } from "../lib/apiClient";
import type { ComunicacionColaborador, PaginatedItems } from "../types";

export const comunicacionesService = {
  /**
   * List comunicaciones for the authenticated collaborator.
   * Returns PaginatedItems where each item is a ComunicacionColaborador:
   *   { id, estado, leido_at, confirmado_at, comunicaciones: { id, asunto, cuerpo, ... } }
   * Note: `comunicaciones` is the nested join from Supabase (table name, plural).
   */
  list: (page = 1, pageSize = 20) =>
    apiClient.get<PaginatedItems<ComunicacionColaborador>>(
      `/comunicaciones/colaborador?page=${page}&page_size=${pageSize}`
    ),

  /**
   * Mark a communication as read (sets leido_at, changes estado to "leido").
   * Idempotent — safe to call multiple times.
   * @param comunicacionId - The comunicacion.id (NOT the destinatario record id)
   */
  marcarLeido: (comunicacionId: string) =>
    apiClient.post<{ leido_at: string }>(
      `/comunicaciones/${comunicacionId}/leer`,
      {}
    ),

  /**
   * Confirm reading of a communication.
   * @param comunicacionId - The comunicacion.id (NOT the destinatario record id)
   */
  confirmar: (comunicacionId: string) =>
    apiClient.post<{ confirmado_at: string }>(
      `/comunicaciones/${comunicacionId}/confirmar`,
      {}
    ),
};
