-- Buckets de Storage faltantes
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'colaborador-documentos',
    'colaborador-documentos',
    false,
    20971520,
    ARRAY[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  ),
  (
    'licencias-documentos',
    'licencias-documentos',
    false,
    10485760,
    ARRAY[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg'
    ]
  )
on conflict (id) do nothing;

-- Políticas RLS para tablas creadas en migración anterior (horario_laboral, colaborador_documentos)
-- El backend usa service_role que bypasea RLS, pero las políticas son necesarias para evitar
-- comportamiento undefined en queries directas.

CREATE POLICY "service_role_all_horario" ON horario_laboral
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_documentos" ON colaborador_documentos
  TO service_role USING (true) WITH CHECK (true);
