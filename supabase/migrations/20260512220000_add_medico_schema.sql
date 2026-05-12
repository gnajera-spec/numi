-- ============================================================
-- Fase 7: Servicio Médico
-- Ley 25.326 — datos de salud encriptados AES-256 a nivel campo
-- ============================================================

-- ── fichas_medicas ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fichas_medicas (
    id                    uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id             uuid         NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    user_id               uuid         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    grupo_sanguineo       text                  CHECK (grupo_sanguineo IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
    factor_rh             text                  CHECK (factor_rh IN ('positivo','negativo')),
    alergias_encrypted    text,
    condiciones_encrypted text,
    observaciones         text,
    created_at            timestamptz  NOT NULL DEFAULT now(),
    updated_at            timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (user_id)
);

ALTER TABLE fichas_medicas ENABLE ROW LEVEL SECURITY;

CREATE INDEX fm_tenant_idx ON fichas_medicas(tenant_id);
CREATE INDEX fm_user_idx   ON fichas_medicas(user_id);

-- ── examenes_medicos ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS examenes_medicos (
    id                  uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id           uuid         NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    user_id             uuid         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    tipo                text         NOT NULL CHECK (tipo IN ('ingreso','periodico','post_ausencia','egreso')),
    fecha               date         NOT NULL,
    resultado           text,
    medico_responsable  text,
    storage_path        text,
    created_by          uuid         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE examenes_medicos ENABLE ROW LEVEL SECURITY;

CREATE INDEX em_user_idx   ON examenes_medicos(user_id, fecha DESC);
CREATE INDEX em_tenant_idx ON examenes_medicos(tenant_id);

-- ── vacunaciones ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vacunaciones (
    id            uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id     uuid         NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    user_id       uuid         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    vacuna        text         NOT NULL,
    fecha         date         NOT NULL,
    lote          text,
    proxima_dosis date,
    created_by    uuid         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at    timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE vacunaciones ENABLE ROW LEVEL SECURITY;

CREATE INDEX vac_user_idx   ON vacunaciones(user_id);
CREATE INDEX vac_tenant_idx ON vacunaciones(tenant_id);

-- ── aptitudes_laborales ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS aptitudes_laborales (
    id                uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id         uuid         NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    user_id           uuid         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    puesto_id         uuid         NOT NULL REFERENCES puestos(id) ON DELETE RESTRICT,
    estado            text         NOT NULL CHECK (estado IN ('apto','apto_con_restricciones','no_apto')),
    restricciones     text,
    fecha_emision     date         NOT NULL,
    fecha_vencimiento date,
    emitido_por       uuid         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at        timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE aptitudes_laborales ENABLE ROW LEVEL SECURITY;

CREATE INDEX apt_user_venc_idx   ON aptitudes_laborales(user_id, fecha_vencimiento);
CREATE INDEX apt_tenant_venc_idx ON aptitudes_laborales(tenant_id, fecha_vencimiento);

-- ── accidentes_trabajo ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS accidentes_trabajo (
    id          uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id   uuid         NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    fecha_hora  timestamptz  NOT NULL,
    lugar       text         NOT NULL,
    descripcion text         NOT NULL,
    testigos    jsonb,
    numero_art  text,
    estado      text         NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','tratamiento','alta','cerrado')),
    created_by  uuid         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE accidentes_trabajo ENABLE ROW LEVEL SECURITY;

CREATE INDEX acc_tenant_estado_idx ON accidentes_trabajo(tenant_id, estado);
CREATE INDEX acc_user_idx          ON accidentes_trabajo(user_id);

-- ── documentos_medicos ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentos_medicos (
    id               uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id        uuid         NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    user_id          uuid         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    tipo             text         NOT NULL CHECK (tipo IN ('certificado_baja','informe_medico','resultado_examen','otro')),
    solicitud_id     uuid                  REFERENCES solicitudes_licencia(id) ON DELETE SET NULL,
    filename         text         NOT NULL,
    storage_path     text         NOT NULL,
    file_size_bytes  integer      NOT NULL,
    mime_type        text         NOT NULL,
    uploaded_by      uuid         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at       timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE documentos_medicos ENABLE ROW LEVEL SECURITY;

CREATE INDEX dm_user_idx   ON documentos_medicos(user_id);
CREATE INDEX dm_tenant_idx ON documentos_medicos(tenant_id);

-- ── updated_at triggers ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_fichas_medicas_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_fichas_medicas_updated_at
    BEFORE UPDATE ON fichas_medicas
    FOR EACH ROW EXECUTE FUNCTION update_fichas_medicas_updated_at();

CREATE OR REPLACE FUNCTION update_accidentes_trabajo_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_accidentes_trabajo_updated_at
    BEFORE UPDATE ON accidentes_trabajo
    FOR EACH ROW EXECUTE FUNCTION update_accidentes_trabajo_updated_at();

-- ── Storage bucket para documentos médicos ───────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-medicos', 'documentos-medicos', false)
ON CONFLICT (id) DO NOTHING;
