-- ============================================================
-- Fase 5: Comunicaciones institucionales
-- ============================================================

-- ── comunicaciones ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comunicaciones (
    id                    uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id             uuid         NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    asunto                text         NOT NULL CHECK (char_length(asunto) <= 200),
    cuerpo                text         NOT NULL CHECK (char_length(cuerpo) <= 5000),
    tipo_segmento         text         NOT NULL CHECK (tipo_segmento IN ('todos', 'sede', 'departamento', 'puesto', 'lista_custom')),
    segmento_config       jsonb        NOT NULL DEFAULT '{}',
    requiere_confirmacion boolean      NOT NULL DEFAULT false,
    programado_at         timestamptz,
    enviado_at            timestamptz,
    estado                text         NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'programado', 'enviando', 'enviado', 'cancelado')),
    total_destinatarios   integer      NOT NULL DEFAULT 0,
    created_by            uuid         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at            timestamptz  NOT NULL DEFAULT now(),
    updated_at            timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE comunicaciones ENABLE ROW LEVEL SECURITY;

CREATE INDEX com_tenant_estado_idx ON comunicaciones(tenant_id, estado);
CREATE INDEX com_tenant_created_idx ON comunicaciones(tenant_id, created_at DESC);

-- ── comunicacion_destinatarios ──────────────────────────────
CREATE TABLE IF NOT EXISTS comunicacion_destinatarios (
    id                uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    comunicacion_id   uuid         NOT NULL REFERENCES comunicaciones(id) ON DELETE CASCADE,
    user_id           uuid         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    estado            text         NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviado', 'entregado', 'leido', 'confirmado', 'sin_respuesta')),
    enviado_at        timestamptz,
    entregado_at      timestamptz,
    leido_at          timestamptz,
    confirmado_at     timestamptz,
    created_at        timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (comunicacion_id, user_id)
);

ALTER TABLE comunicacion_destinatarios ENABLE ROW LEVEL SECURITY;

CREATE INDEX com_dest_comunicacion_estado_idx ON comunicacion_destinatarios(comunicacion_id, estado);
CREATE INDEX com_dest_user_idx ON comunicacion_destinatarios(user_id);

-- ── comunicacion_adjuntos ───────────────────────────────────
CREATE TABLE IF NOT EXISTS comunicacion_adjuntos (
    id                uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    comunicacion_id   uuid         NOT NULL REFERENCES comunicaciones(id) ON DELETE CASCADE,
    filename          text         NOT NULL,
    storage_path      text         NOT NULL,
    file_url          text         NOT NULL,
    file_size_bytes   integer      NOT NULL,
    mime_type         text         NOT NULL,
    created_at        timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE comunicacion_adjuntos ENABLE ROW LEVEL SECURITY;

-- ── updated_at trigger ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_comunicaciones_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_comunicaciones_updated_at
    BEFORE UPDATE ON comunicaciones
    FOR EACH ROW EXECUTE FUNCTION update_comunicaciones_updated_at();

-- ── Storage bucket para adjuntos ────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('comunicaciones', 'comunicaciones', false)
ON CONFLICT (id) DO NOTHING;
