-- ── DT-007 fix: add reversible encrypted wa_id for outbound notifications ────
alter table users add column if not exists whatsapp_id_encrypted text;

-- ── tipos_licencia ────────────────────────────────────────────────────────────
create table tipos_licencia (
    id                   uuid primary key default gen_random_uuid(),
    tenant_id            uuid references tenants(id) on delete restrict,
    codigo               text not null,
    nombre               text not null,
    descripcion          text,
    requiere_certificado boolean not null default false,
    es_medica            boolean not null default false,
    dias_maximos         integer,
    is_active            boolean not null default true,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now(),
    constraint tipos_licencia_tenant_codigo_unique unique (tenant_id, codigo)
);

alter table tipos_licencia enable row level security;

create trigger set_tipos_licencia_updated_at
    before update on tipos_licencia
    for each row execute function update_updated_at_column();

-- ── politicas_licencia ────────────────────────────────────────────────────────
create table politicas_licencia (
    id                   uuid primary key default gen_random_uuid(),
    tenant_id            uuid not null references tenants(id) on delete restrict,
    tipo_licencia_id     uuid not null references tipos_licencia(id) on delete restrict,
    convenio_id          uuid references convenios(id) on delete restrict,
    dias_base            integer not null,
    reglas_antiguedad    jsonb,
    requiere_aprobacion  boolean not null default true,
    dias_aviso_previo    integer not null default 0,
    aprobador_rol        text not null default 'rrhh',
    is_active            boolean not null default true,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now(),
    constraint politicas_tipo_convenio_unique unique (tenant_id, tipo_licencia_id, convenio_id),
    constraint politicas_aprobador_check check (aprobador_rol in ('rrhh', 'admin_empresa'))
);

alter table politicas_licencia enable row level security;

create trigger set_politicas_licencia_updated_at
    before update on politicas_licencia
    for each row execute function update_updated_at_column();

-- ── solicitudes_licencia ──────────────────────────────────────────────────────
create sequence if not exists solicitudes_licencia_num_seq start 1;

create table solicitudes_licencia (
    id                   uuid primary key default gen_random_uuid(),
    tenant_id            uuid not null references tenants(id) on delete restrict,
    numero_solicitud     text not null,
    user_id              uuid not null references users(id) on delete restrict,
    tipo_licencia_id     uuid not null references tipos_licencia(id) on delete restrict,
    fecha_inicio         date not null,
    fecha_fin            date not null,
    dias_habiles         integer not null,
    estado               text not null default 'pendiente',
    comentario_empleado  text,
    comentario_rrhh      text,
    revisado_por         uuid references users(id) on delete set null,
    revisado_at          timestamptz,
    canal                text not null default 'portal',
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now(),
    constraint solicitudes_tenant_numero_unique unique (tenant_id, numero_solicitud),
    constraint solicitudes_estado_check check (
        estado in ('borrador', 'pendiente', 'en_revision', 'aprobada', 'rechazada', 'cancelada', 'vencida')
    ),
    constraint solicitudes_canal_check check (canal in ('whatsapp', 'portal')),
    constraint solicitudes_fechas_check check (fecha_fin >= fecha_inicio)
);

alter table solicitudes_licencia enable row level security;

create trigger set_solicitudes_licencia_updated_at
    before update on solicitudes_licencia
    for each row execute function update_updated_at_column();

create or replace function generate_numero_solicitud()
returns trigger as $$
begin
    new.numero_solicitud = 'LIC-' || to_char(now(), 'YYYY') || '-' ||
        lpad(nextval('solicitudes_licencia_num_seq')::text, 5, '0');
    return new;
end;
$$ language plpgsql;

create trigger trg_generate_numero_solicitud
    before insert on solicitudes_licencia
    for each row execute function generate_numero_solicitud();

create index solicitudes_tenant_estado_idx  on solicitudes_licencia(tenant_id, estado);
create index solicitudes_user_idx           on solicitudes_licencia(user_id);
create index solicitudes_revisado_por_idx   on solicitudes_licencia(revisado_por) where revisado_por is not null;

-- ── saldo_licencias ───────────────────────────────────────────────────────────
create table saldo_licencias (
    id                uuid primary key default gen_random_uuid(),
    tenant_id         uuid not null references tenants(id) on delete restrict,
    user_id           uuid not null references users(id) on delete restrict,
    tipo_licencia_id  uuid not null references tipos_licencia(id) on delete restrict,
    anio              integer not null,
    dias_disponibles  integer not null default 0,
    dias_tomados      integer not null default 0,
    dias_pendientes   integer not null default 0,
    updated_at        timestamptz not null default now(),
    constraint saldo_user_tipo_anio_unique unique (tenant_id, user_id, tipo_licencia_id, anio)
);

alter table saldo_licencias enable row level security;

create trigger set_saldo_licencias_updated_at
    before update on saldo_licencias
    for each row execute function update_updated_at_column();

-- ── documentos_solicitud ──────────────────────────────────────────────────────
create table documentos_solicitud (
    id               uuid primary key default gen_random_uuid(),
    solicitud_id     uuid not null references solicitudes_licencia(id) on delete cascade,
    filename         text not null,
    storage_path     text not null,
    file_url         text not null,
    file_size_bytes  integer not null,
    mime_type        text not null,
    uploaded_by      uuid not null references users(id) on delete restrict,
    created_at       timestamptz not null default now()
);

alter table documentos_solicitud enable row level security;

-- ── Seed: tipos de licencia globales (tenant_id IS NULL) ─────────────────────
insert into tipos_licencia (tenant_id, codigo, nombre, descripcion, requiere_certificado, es_medica, dias_maximos) values
(null, 'VAC',   'Vacaciones anuales',      'Vacaciones anuales según antigüedad y convenio',                false, false, null),
(null, 'ENF',   'Enfermedad inculpable',   'Licencia por enfermedad. Requiere certificado médico',          true,  true,  null),
(null, 'MAT',   'Maternidad',              'Licencia por maternidad. Requiere partida/certificado nacimiento', true, false, 90),
(null, 'PAT',   'Paternidad',              'Licencia por paternidad. Requiere partida de nacimiento',        true,  false, 2),
(null, 'MAT-C', 'Matrimonio',              'Licencia por matrimonio. Requiere partida matrimonial',          true,  false, 10),
(null, 'DUE',   'Fallecimiento familiar',  'Licencia por duelo. Requiere acta de defunción',                true,  false, 3),
(null, 'EST',   'Examen / Estudio',        'Licencia por examen o estudio. Requiere certificado',           true,  false, null),
(null, 'ART',   'Accidente de trabajo',    'Licencia por accidente de trabajo ART. Requiere denuncia',      true,  true,  null),
(null, 'SGS',   'Sin goce de sueldo',      'Licencia sin goce de sueldo. No requiere documentación',        false, false, null),
(null, 'CUST',  'Personalizada',           'Tipo de licencia personalizada por la empresa',                 false, false, null);
