-- Sesión 22: Reestructura licencias médicas
-- 1. Crea tipo global MED (Licencia Médica, único tipo médico)
-- 2. Migra solicitudes y saldos de ENF/ART → MED
-- 3. Desactiva ENF y ART
-- 4. Agrega tipo_accion a pasos_flujo (aprobar | solo_ver | derivar)
-- 5. Agrega estado 'derivado' a aprobaciones_solicitud

-- ─── 1. Crear tipo MED ────────────────────────────────────────────────────────
INSERT INTO tipos_licencia (tenant_id, codigo, nombre, descripcion, requiere_certificado, es_medica, dias_maximos)
VALUES (NULL, 'MED', 'Licencia Médica', 'Licencia por enfermedad o accidente de trabajo. Requiere certificado médico.', true, true, NULL)
ON CONFLICT (tenant_id, codigo) DO NOTHING;

-- ─── 2. Migrar solicitudes_licencia ENF/ART → MED ────────────────────────────
UPDATE solicitudes_licencia
SET tipo_licencia_id = (
  SELECT id FROM tipos_licencia WHERE codigo = 'MED' AND tenant_id IS NULL
)
WHERE tipo_licencia_id IN (
  SELECT id FROM tipos_licencia WHERE codigo IN ('ENF', 'ART') AND tenant_id IS NULL
);

-- ─── 3. Migrar saldo_licencias ENF/ART → MED ─────────────────────────────────
-- Si ya existe un saldo MED para el mismo usuario/tenant/año, sumamos al existente
-- Si no existe, actualizamos la fila ENF/ART al nuevo tipo MED
WITH med_id AS (
  SELECT id FROM tipos_licencia WHERE codigo = 'MED' AND tenant_id IS NULL
),
enf_art_ids AS (
  SELECT id FROM tipos_licencia WHERE codigo IN ('ENF', 'ART') AND tenant_id IS NULL
)
UPDATE saldo_licencias sl
SET tipo_licencia_id = (SELECT id FROM med_id)
WHERE sl.tipo_licencia_id IN (SELECT id FROM enf_art_ids)
  AND NOT EXISTS (
    SELECT 1 FROM saldo_licencias sl2
    WHERE sl2.user_id = sl.user_id
      AND sl2.tenant_id = sl.tenant_id
      AND sl2.anio = sl.anio
      AND sl2.tipo_licencia_id = (SELECT id FROM med_id)
  );

-- Eliminar duplicados de saldo si MED ya existía (suma y deja uno)
-- Caso borde: si un usuario tenía saldo ENF Y ART y ya tenía MED
DELETE FROM saldo_licencias
WHERE tipo_licencia_id IN (
  SELECT id FROM tipos_licencia WHERE codigo IN ('ENF', 'ART') AND tenant_id IS NULL
);

-- ─── 4. Desactivar ENF y ART ─────────────────────────────────────────────────
UPDATE tipos_licencia
SET is_active = false
WHERE codigo IN ('ENF', 'ART') AND tenant_id IS NULL;

-- ─── 5. Agregar tipo_accion a pasos_flujo ────────────────────────────────────
ALTER TABLE pasos_flujo
  ADD COLUMN IF NOT EXISTS tipo_accion text NOT NULL DEFAULT 'aprobar'
    CHECK (tipo_accion IN ('aprobar', 'solo_ver', 'derivar'));

-- ─── 6. Agregar tipo_accion snapshot a aprobaciones_solicitud ────────────────
-- Guardamos tipo_accion como snapshot (igual que rol_aprobador, departamento_id)
ALTER TABLE aprobaciones_solicitud
  ADD COLUMN IF NOT EXISTS tipo_accion text NOT NULL DEFAULT 'aprobar'
    CHECK (tipo_accion IN ('aprobar', 'solo_ver', 'derivar'));

-- ─── 7. Agregar 'derivado' al estado de aprobaciones_solicitud ───────────────
ALTER TABLE aprobaciones_solicitud
  DROP CONSTRAINT IF EXISTS aprobaciones_solicitud_estado_check;

ALTER TABLE aprobaciones_solicitud
  ADD CONSTRAINT aprobaciones_solicitud_estado_check
    CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'omitido', 'derivado'));
