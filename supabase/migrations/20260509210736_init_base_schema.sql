-- ============================================================
-- HRConnect — Migración inicial
-- Módulos: Core (tenants, estructura org) + Auth (users, invite_tokens)
-- ============================================================

-- ============================================================
-- FUNCIÓN UTILITARIA: updated_at automático
-- ============================================================

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- TENANTS
-- ============================================================

create table tenants (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  nombre_corto      text not null,
  cuit              text not null,
  subdominio        text not null,
  plan              text not null default 'starter',
  estado            text not null default 'activo',
  logo_url          text,
  color_primario    text,
  whatsapp_numero   text,
  max_colaboradores integer not null default 100,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint tenants_cuit_unique unique (cuit),
  constraint tenants_subdominio_unique unique (subdominio),
  constraint tenants_plan_check check (plan in ('starter', 'professional', 'enterprise')),
  constraint tenants_estado_check check (estado in ('activo', 'suspendido', 'baja')),
  constraint tenants_subdominio_format check (subdominio ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  constraint tenants_color_format check (
    color_primario ~ '^#[0-9A-Fa-f]{6}$' or color_primario is null
  )
);

create trigger set_tenants_updated_at
  before update on tenants
  for each row execute function update_updated_at_column();

alter table tenants enable row level security;

-- ============================================================
-- ESTRUCTURA ORGANIZACIONAL
-- ============================================================

create table sedes (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete restrict,
  nombre     text not null,
  direccion  text,
  ciudad     text,
  provincia  text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sedes_nombre_tenant_unique unique (tenant_id, nombre)
);

create index sedes_tenant_idx on sedes(tenant_id);

create trigger set_sedes_updated_at
  before update on sedes
  for each row execute function update_updated_at_column();

alter table sedes enable row level security;

-- -------------------------------------------------------

create table departamentos (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete restrict,
  nombre     text not null,
  padre_id   uuid references departamentos(id) on delete restrict,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint departamentos_nombre_unique unique (tenant_id, nombre, padre_id)
);

create index departamentos_tenant_idx on departamentos(tenant_id);
create index departamentos_padre_idx on departamentos(padre_id) where padre_id is not null;

create trigger set_departamentos_updated_at
  before update on departamentos
  for each row execute function update_updated_at_column();

alter table departamentos enable row level security;

-- -------------------------------------------------------

create table puestos (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references tenants(id) on delete restrict,
  nombre                 text not null,
  descripcion            text,
  meses_vigencia_aptitud integer,
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint puestos_nombre_tenant_unique unique (tenant_id, nombre),
  constraint puestos_vigencia_check check (
    meses_vigencia_aptitud is null
    or (meses_vigencia_aptitud >= 1 and meses_vigencia_aptitud <= 60)
  )
);

create index puestos_tenant_idx on puestos(tenant_id);

create trigger set_puestos_updated_at
  before update on puestos
  for each row execute function update_updated_at_column();

alter table puestos enable row level security;

-- -------------------------------------------------------

create table convenios (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete restrict,
  nombre      text not null,
  descripcion text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint convenios_nombre_tenant_unique unique (tenant_id, nombre)
);

create index convenios_tenant_idx on convenios(tenant_id);

create trigger set_convenios_updated_at
  before update on convenios
  for each row execute function update_updated_at_column();

alter table convenios enable row level security;

-- ============================================================
-- USERS
-- ============================================================

create table users (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid references tenants(id) on delete restrict,
  email                  text not null,
  password_hash          text,
  first_name             text not null,
  last_name              text not null,
  cuil                   text,
  role                   text not null,
  estado                 text not null default 'pendiente',
  whatsapp_id_encrypted  text,
  whatsapp_numero_masked text,
  mfa_enabled            boolean not null default false,
  mfa_secret_encrypted   text,
  avatar_url             text,
  last_login_at          timestamptz,
  activated_at           timestamptz,
  suspended_at           timestamptz,
  baja_at                timestamptz,
  created_by             uuid references users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint users_email_unique unique (email),
  constraint users_role_check check (
    role in ('super_admin', 'admin_empresa', 'rrhh', 'servicio_medico', 'colaborador')
  ),
  constraint users_estado_check check (
    estado in ('pendiente', 'activo', 'suspendido', 'baja')
  ),
  constraint users_tenant_role_check check (
    (role = 'super_admin' and tenant_id is null)
    or (role != 'super_admin' and tenant_id is not null)
  )
);

create unique index users_email_idx on users(email);
create unique index users_cuil_tenant_idx on users(tenant_id, cuil) where cuil is not null;
create index users_tenant_role_estado_idx on users(tenant_id, role, estado);
create index users_tenant_activos_idx on users(tenant_id, estado) where estado = 'activo';

create trigger set_users_updated_at
  before update on users
  for each row execute function update_updated_at_column();

alter table users enable row level security;

-- ============================================================
-- COLABORADOR PERFIL
-- ============================================================

create table colaborador_perfil (
  user_id           uuid primary key references users(id) on delete restrict,
  tenant_id         uuid not null references tenants(id) on delete restrict,
  legajo            text,
  sede_id           uuid references sedes(id) on delete set null,
  departamento_id   uuid references departamentos(id) on delete set null,
  puesto_id         uuid references puestos(id) on delete set null,
  convenio_id       uuid references convenios(id) on delete set null,
  fecha_ingreso     date,
  tipo_contrato     text,
  fecha_nacimiento  date,
  genero            text,
  nacionalidad      text not null default 'AR',
  email_personal    text,
  telefono_personal text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint col_tipo_contrato_check check (
    tipo_contrato in ('indefinido', 'determinado', 'eventual', 'pasantia')
    or tipo_contrato is null
  ),
  constraint col_genero_check check (
    genero in ('masculino', 'femenino', 'no_binario', 'no_especificado')
    or genero is null
  )
);

create unique index col_legajo_tenant_idx
  on colaborador_perfil(tenant_id, legajo)
  where legajo is not null;

create index col_perfil_sede_idx on colaborador_perfil(sede_id);
create index col_perfil_dept_idx on colaborador_perfil(departamento_id);
create index col_perfil_puesto_idx on colaborador_perfil(puesto_id);
create index col_perfil_tenant_idx on colaborador_perfil(tenant_id);

create trigger set_col_perfil_updated_at
  before update on colaborador_perfil
  for each row execute function update_updated_at_column();

alter table colaborador_perfil enable row level security;

-- ============================================================
-- INVITE TOKENS
-- ============================================================

create table invite_tokens (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete restrict,
  token_hash     text not null,
  expires_at     timestamptz not null,
  used_at        timestamptz,
  invalidated_at timestamptz,
  created_by     uuid not null references users(id) on delete restrict,
  created_at     timestamptz not null default now(),

  constraint invite_tokens_hash_unique unique (token_hash)
);

create index invite_tokens_user_idx on invite_tokens(user_id);

alter table invite_tokens enable row level security;

-- ============================================================
-- AUDIT LOG
-- Inmutable — solo INSERT, nunca UPDATE ni DELETE
-- ============================================================

create table audit_log (
  id             bigserial primary key,
  tenant_id      uuid,
  entity_type    text not null,
  entity_id      uuid not null,
  action         text not null,
  changed_fields jsonb,
  performed_by   uuid,
  performed_at   timestamptz not null default now(),
  ip_address     inet,
  request_id     text,

  constraint audit_action_check check (
    action in ('created', 'updated', 'deleted', 'activated', 'suspended',
               'signed', 'approved', 'rejected', 'invited', 'baja')
  )
);

create index audit_entity_idx on audit_log(entity_type, entity_id);
create index audit_tenant_idx on audit_log(tenant_id, performed_at desc);
create index audit_performed_by_idx on audit_log(performed_by);

alter table audit_log enable row level security;

create policy audit_log_super_admin on audit_log
  for select
  using (auth.jwt() ->> 'role' = 'super_admin');
