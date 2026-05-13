import { apiClient } from "../lib/apiClient";
import type { UserSummary, CreateUserRequest, Paginated } from "../types";

export const adminUsuariosService = {
  list: (params: {
    estado?: string;
    role?: string;
    search?: string;
    page?: number;
    page_size?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.estado) qs.set("estado", params.estado);
    if (params.role) qs.set("role", params.role);
    if (params.search) qs.set("search", params.search);
    qs.set("page", String(params.page ?? 1));
    qs.set("page_size", String(params.page_size ?? 20));
    return apiClient.get<Paginated<UserSummary>>(`/users?${qs}`);
  },

  create: (data: CreateUserRequest) =>
    apiClient.post<UserSummary>("/users", data),

  invite: (id: string) =>
    apiClient.post<{ expires_at: string; sent_via: string }>(
      `/users/${id}/invite`,
      {}
    ),

  suspend: (id: string, motivo?: string) =>
    apiClient.post<void>(`/users/${id}/suspend`, { motivo: motivo ?? "" }),

  reactivate: (id: string) =>
    apiClient.post<UserSummary>(`/users/${id}/reactivate`, {}),

  baja: (id: string, motivo?: string) =>
    apiClient.post<void>(`/users/${id}/baja`, { motivo: motivo ?? "" }),
};
