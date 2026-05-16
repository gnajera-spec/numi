import { apiClient } from "../lib/apiClient";

export interface SmtpConfigOut {
  host: string;
  port: number;
  username: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
  activo: boolean;
  use_numi_smtp: boolean;
}

export interface SmtpConfigIn extends SmtpConfigOut {
  password: string;
}

export interface SmtpTestResult {
  ok: boolean;
  message: string;
}

export const smtpConfigService = {
  get: () => apiClient.get<SmtpConfigOut | null>("/admin/configuracion/smtp"),
  save: (data: SmtpConfigIn) => apiClient.put<SmtpConfigOut>("/admin/configuracion/smtp", data),
  test: (data: SmtpConfigIn) => apiClient.post<SmtpTestResult>("/admin/configuracion/smtp/test", data),
};
