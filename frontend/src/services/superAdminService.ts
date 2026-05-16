import { apiClient } from "../lib/apiClient";
import type { UserSummary,
  CreateTenantRequest,
  TenantCreateResponse,
  TenantOut,
  UpdateTenantRequest,
  PaginatedItems,
  TenantSummary,
} from "../types";

export const superAdminService = {
  listTenants: (params: { estado?: string; plan?: string; search?: string; page?: number; page_size?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.estado) qs.set("estado", params.estado);
    if (params.plan) qs.set("plan", params.plan);
    if (params.search) qs.set("search", params.search);
    qs.set("page", String(params.page ?? 1));
    qs.set("page_size", String(params.page_size ?? 20));
    return apiClient.get<PaginatedItems<TenantSummary>>(`/tenants?${qs}`);
  },

  createTenant: (data: CreateTenantRequest) =>
    apiClient.post<TenantCreateResponse>("/tenants", data),

  getTenant: (id: string) =>
    apiClient.get<TenantOut>(`/tenants/${id}`),

  updateTenant: (id: string, data: UpdateTenantRequest) =>
    apiClient.patch<TenantOut>(`/tenants/${id}`, data),

  listTenantUsers: (tenantId: string) =>
    apiClient.get<UserSummary[]>(`/tenants/${tenantId}/users`),

  setTenantUserRole: (tenantId: string, userId: string, role: string) =>
    apiClient.patch<UserSummary>(`/tenants/${tenantId}/users/${userId}/set-role`, { role }),

  setTenantUserRoles: (tenantId: string, userId: string, roles: string[]) =>
    apiClient.patch<UserSummary>(`/tenants/${tenantId}/users/${userId}/set-roles`, { roles }),
};
