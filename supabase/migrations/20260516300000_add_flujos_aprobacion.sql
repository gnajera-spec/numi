-- REQ_14: Flujos de aprobación parametrizables para licencias

-- ─── flujos_aprobacion ────────────────────────────────────────────────────────
CREATE TABLE flujos_aprobacion (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  tipo_licencia_id uuid       NOT NULL REFERENCES tipos_licencia(id) ON DELETE RESTRICT,
  nombre          text        NOT NULL CHECK (char_length(nombre) <= 100),
  descripcion     text,
  is_active       boolean     NOT NULL DEFAULT true,
  created_by      uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Solo un flujo activo por empresa + tipo de licencia
CREATE UNIQUE INDEX flujos_aprobacion_activo_unique
  ON flujos_aprobacion(tenant_id, tipo_licencia_id)
  WHERE is_active = true;

ALTER TABLE flujos_aprobacion ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER flujos_aprobacion_updated_at
  BEFORE UPDATE ON flujos_aprobacion
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ─── pasos_flujo ──────────────────────────────────────────────────────────────
CREATE TABLE pasos_flujo (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flujo_id            uuid        NOT NULL REFERENCES flujos_aprobacion(id) ON DELETE CASCADE,
  tenant_id           uuid        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  orden               integer     NOT NULL,
  nombre              text        NOT NULL CHECK (char_length(nombre) <= 100),
  tipo_aprobador      text        NOT NULL CHECK (tipo_aprobador IN ('rol', 'departamento')),
  rol_aprobador       text        CHECK (rol_aprobador IN ('rrhh', 'servicio_medico', 'admin_empresa')),
  departamento_id     uuid        REFERENCES departamentos(id) ON DELETE RESTRICT,
  sla_horas           integer     CHECK (sla_horas IS NULL OR sla_horas > 0),
  requiere_comentario boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (flujo_id, orden),
  CHECK (orden >= 1 AND orden <= 5),
  -- Exclusividad por tipo: exactamente uno de los dos campos debe estar seteado
  CHECK (
    (tipo_aprobador = 'rol' AND rol_aprobador IS NOT NULL AND departamento_id IS NULL)
    OR
    (tipo_aprobador = 'departamento' AND departamento_id IS NOT NULL AND rol_aprobador IS NULL)
  )
);

CREATE INDEX pasos_flujo_flujo_idx ON pasos_flujo(flujo_id, orden);
CREATE INDEX pasos_flujo_departamento_idx ON pasos_flujo(departamento_id) WHERE departamento_id IS NOT NULL;

ALTER TABLE pasos_flujo ENABLE ROW LEVEL SECURITY;

-- ─── aprobaciones_solicitud ───────────────────────────────────────────────────
CREATE TABLE aprobaciones_solicitud (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitud_id        uuid        NOT NULL REFERENCES solicitudes_licencia(id) ON DELETE CASCADE,
  tenant_id           uuid        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  paso_id             uuid        NOT NULL REFERENCES pasos_flujo(id) ON DELETE RESTRICT,
  orden               integer     NOT NULL,
  nombre_paso         text        NOT NULL,
  tipo_aprobador      text        NOT NULL CHECK (tipo_aprobador IN ('rol', 'departamento')),
  rol_aprobador       text,
  departamento_id     uuid,
  departamento_nombre text,
  estado              text        NOT NULL DEFAULT 'pendiente'
                                  CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'omitido')),
  aprobado_por        uuid        REFERENCES users(id) ON DELETE SET NULL,
  comentario          text,
  notificado_at       timestamptz,
  fecha_decision      timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (solicitud_id, orden)
);

CREATE INDEX aprobaciones_solicitud_solicitud_idx
  ON aprobaciones_solicitud(solicitud_id, orden);

CREATE INDEX aprobaciones_por_rol_pendiente_idx
  ON aprobaciones_solicitud(tenant_id, rol_aprobador, estado)
  WHERE estado = 'pendiente' AND tipo_aprobador = 'rol';

CREATE INDEX aprobaciones_por_departamento_pendiente_idx
  ON aprobaciones_solicitud(tenant_id, departamento_id, estado)
  WHERE estado = 'pendiente' AND tipo_aprobador = 'departamento';

ALTER TABLE aprobaciones_solicitud ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER aprobaciones_solicitud_updated_at
  BEFORE UPDATE ON aprobaciones_solicitud
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ─── Modificar solicitudes_licencia ──────────────────────────────────────────
ALTER TABLE solicitudes_licencia
  ADD COLUMN flujo_id   uuid REFERENCES flujos_aprobacion(id) ON DELETE RESTRICT,
  ADD COLUMN paso_actual integer;

CREATE INDEX solicitudes_flujo_paso_idx
  ON solicitudes_licencia(flujo_id, paso_actual)
  WHERE flujo_id IS NOT NULL;
