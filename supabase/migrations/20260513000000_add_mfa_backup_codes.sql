-- MFA backup codes encrypted column
-- mfa_enabled y mfa_secret_encrypted ya existen desde la migración inicial

alter table users
  add column if not exists mfa_backup_codes_encrypted text;
