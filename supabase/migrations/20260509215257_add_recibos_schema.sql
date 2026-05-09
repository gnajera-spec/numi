-- ============================================================
-- HRConnect — Recibos de sueldo
-- Tablas: periodos_liquidacion, recibos, firmas_electronicas
-- Storage: bucket recibos (privado)
-- ============================================================

-- ============================================================
-- PERÍODOS DE LIQUIDACIÓN
-- ============================================================

create table periodos_liquidacion (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete restrict,
  periodo             text not null,
  descripcion         text,
  fecha_inicio        date not null,
  fecha_fin           date not null,
  fecha_limite_firma  date,
  estado              text not null default 'borrador',
  total_recibos       integer not null default 0,
  recibos_firmados    integer not null default 0,
  created_by          uuid not null references users(id) on delete restrict,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint periodos_unique unique (tenant_id, periodo, descripcion),
  constraint periodos_estado_check check (estado in ('borrador', 'distribuido', 'cerrado')),
  constraint periodos_fechas_check check (fecha_fin >= fecha_inicio)
);

create index periodos_tenant_estado_idx on periodos_liquidacion(tenant_id, estado);
create index periodos_tenant_periodo_idx on periodos_liquidacion(tenant_id, periodo);

create trigger set_periodos_updated_at
  before update on periodos_liquidacion
  for each row execute function update_updated_at_column();

alter table periodos_liquidacion enable row level security;

-- ============================================================
-- RECIBOS
-- ============================================================

create table recibos (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete restrict,
  periodo_id          uuid not null references periodos_liquidacion(id) on delete restrict,
  user_id             uuid not null references users(id) on delete restrict,
  storage_path        text not null,
  archivo_hash        text not null,
  archivo_size_bytes  integer not null,
  estado              text not null default 'pendiente',
  notificado_at       timestamptz,
  visto_at            timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint recibos_unique unique (tenant_id, periodo_id, user_id),
  constraint recibos_estado_check check (estado in ('pendiente', 'entregado', 'firmado', 'vencido'))
);

create index recibos_tenant_periodo_idx on recibos(tenant_id, periodo_id);
create index recibos_user_idx on recibos(user_id);
create index recibos_estado_idx on recibos(periodo_id, estado);

create trigger set_recibos_updated_at
  before update on recibos
  for each row execute function update_updated_at_column();

alter table recibos enable row level security;

-- Trigger: mantener recibos_firmados desnormalizado en periodos_liquidacion
create or replace function sync_recibos_firmados()
returns trigger as $$
begin
  if (new.estado = 'firmado' and (old.estado is null or old.estado <> 'firmado')) or
     (old.estado = 'firmado' and new.estado <> 'firmado') then
    update periodos_liquidacion
    set recibos_firmados = (
      select count(*) from recibos
      where periodo_id = coalesce(new.periodo_id, old.periodo_id)
        and estado = 'firmado'
    )
    where id = coalesce(new.periodo_id, old.periodo_id);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger sync_recibos_firmados_trigger
  after update on recibos
  for each row execute function sync_recibos_firmados();

-- ============================================================
-- FIRMAS ELECTRÓNICAS
-- ============================================================

create table firmas_electronicas (
  id               uuid primary key default gen_random_uuid(),
  recibo_id        uuid not null references recibos(id) on delete restrict,
  user_id          uuid not null references users(id) on delete restrict,
  canal            text not null,
  timestamp_firma  timestamptz not null,
  ip_address       inet,
  session_id       text,
  wa_session_hash  text,
  archivo_hash     text not null,
  created_at       timestamptz not null default now(),

  constraint firmas_recibo_unique unique (recibo_id),
  constraint firmas_canal_check check (canal in ('whatsapp', 'portal'))
);

create index firmas_user_idx on firmas_electronicas(user_id);

alter table firmas_electronicas enable row level security;

-- ============================================================
-- STORAGE BUCKET — privado, solo acceso vía signed URL
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recibos',
  'recibos',
  false,
  52428800,
  ARRAY['application/pdf', 'application/zip']
)
on conflict (id) do nothing;
