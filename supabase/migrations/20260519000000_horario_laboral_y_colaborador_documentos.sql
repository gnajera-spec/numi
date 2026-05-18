-- Horario laboral semanal del colaborador
CREATE TABLE horario_laboral (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  user_id      uuid        NOT NULL REFERENCES users(id)   ON DELETE RESTRICT,
  dia_semana   smallint    NOT NULL,   -- 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb, 7=Dom
  hora_inicio  time        NOT NULL,
  hora_fin     time        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dia_semana),
  CHECK (dia_semana BETWEEN 1 AND 7),
  CHECK (hora_fin > hora_inicio)
);

ALTER TABLE horario_laboral ENABLE ROW LEVEL SECURITY;

-- Documentos adjuntos al legajo del colaborador
CREATE TABLE colaborador_documentos (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  user_id          uuid        NOT NULL REFERENCES users(id)   ON DELETE RESTRICT,
  tipo             text        NOT NULL CHECK (tipo IN ('cv','titulo','certificado','contrato','otro')),
  filename         text        NOT NULL,
  storage_path     text        NOT NULL,
  file_url         text        NOT NULL,
  file_size_bytes  integer     NOT NULL,
  mime_type        text        NOT NULL,
  descripcion      text,
  uploaded_by      uuid        NOT NULL REFERENCES users(id)   ON DELETE RESTRICT,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE colaborador_documentos ENABLE ROW LEVEL SECURITY;
