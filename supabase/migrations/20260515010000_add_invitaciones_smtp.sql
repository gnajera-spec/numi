-- ============================================================
-- Tabla: invitaciones
-- ============================================================
CREATE TABLE IF NOT EXISTS invitaciones (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cuil         VARCHAR(11) NOT NULL,
    email        VARCHAR(255) NOT NULL,
    token        UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    estado       VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente', 'completada', 'expirada')),
    expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_invitaciones_token     ON invitaciones(token);
CREATE INDEX IF NOT EXISTS idx_invitaciones_tenant_id ON invitaciones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitaciones_email     ON invitaciones(email);

-- ============================================================
-- Tabla: smtp_config
-- ============================================================
CREATE TABLE IF NOT EXISTS smtp_config (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    host           VARCHAR(255) NOT NULL DEFAULT '',
    port           INTEGER NOT NULL DEFAULT 587,
    username       VARCHAR(255) NOT NULL DEFAULT '',
    password_enc   TEXT NOT NULL DEFAULT '',
    from_email     VARCHAR(255) NOT NULL DEFAULT '',
    from_name      VARCHAR(255) NOT NULL DEFAULT 'NUMI',
    use_tls        BOOLEAN NOT NULL DEFAULT true,
    use_numi_smtp  BOOLEAN NOT NULL DEFAULT true,
    activo         BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
