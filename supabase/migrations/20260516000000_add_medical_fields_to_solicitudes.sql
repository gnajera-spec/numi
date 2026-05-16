-- Add medical license fields to solicitudes_licencia
alter table solicitudes_licencia
  add column if not exists medico_nombre    text,
  add column if not exists medico_apellido  text,
  add column if not exists medico_matricula text,
  add column if not exists dias_reposo      integer;
