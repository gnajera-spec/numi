-- Add whatsapp_id_hash to users for efficient wa_id lookup (SHA-256 of raw wa_id)
alter table users add column if not exists whatsapp_id_hash text;
create unique index if not exists users_wa_id_hash_idx on users(whatsapp_id_hash) where whatsapp_id_hash is not null;

-- whatsapp_config: configuración de la cuenta WA Business por tenant (1:1)
create table whatsapp_config (
    id                    uuid primary key default gen_random_uuid(),
    tenant_id             uuid not null references tenants(id) on delete restrict,
    phone_number_id       text not null,
    business_account_id   text not null,
    access_token_encrypted text not null,
    verify_token          text not null,
    mensaje_bienvenida    text,
    horario_atencion      jsonb,
    is_active             boolean not null default false,
    verificado_at         timestamptz,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now(),
    constraint whatsapp_config_tenant_unique unique (tenant_id),
    constraint whatsapp_config_phone_unique  unique (phone_number_id)
);

alter table whatsapp_config enable row level security;

create trigger set_whatsapp_config_updated_at
    before update on whatsapp_config
    for each row execute function update_updated_at_column();

-- whatsapp_sessions: estado de la FSM del bot por usuario
create table whatsapp_sessions (
    id                uuid primary key default gen_random_uuid(),
    tenant_id         uuid not null references tenants(id) on delete restrict,
    user_id           uuid not null references users(id) on delete restrict,
    estado_bot        text not null default 'idle',
    contexto          jsonb not null default '{}',
    ultimo_mensaje_at timestamptz not null default now(),
    expira_at         timestamptz not null,
    mensajes_count    integer not null default 0,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),
    constraint whatsapp_sessions_user_unique unique (tenant_id, user_id),
    constraint whatsapp_sessions_estado_check check (
        estado_bot in (
            'idle', 'menu_principal',
            'recibos_ver', 'recibos_historial', 'recibos_confirmar',
            'licencias_tipo', 'licencias_fechas', 'licencias_certificado', 'licencias_confirmar', 'licencias_saldo',
            'comunicaciones_ver', 'comunicaciones_confirmar',
            'ayuda'
        )
    )
);

alter table whatsapp_sessions enable row level security;

create trigger set_whatsapp_sessions_updated_at
    before update on whatsapp_sessions
    for each row execute function update_updated_at_column();

-- whatsapp_message_log: log de mensajes (retención 90 días)
create table whatsapp_message_log (
    id              bigserial primary key,
    tenant_id       uuid not null references tenants(id) on delete restrict,
    user_id         uuid references users(id) on delete restrict,
    wa_message_id   text,
    direction       text not null,
    tipo            text not null,
    contenido       text,
    template_name   text,
    metadata        jsonb,
    created_at      timestamptz not null default now(),
    constraint wa_log_message_id_unique unique (wa_message_id),
    constraint wa_log_direction_check check (direction in ('inbound', 'outbound')),
    constraint wa_log_tipo_check     check (tipo in ('text', 'template', 'interactive', 'document', 'image'))
);

alter table whatsapp_message_log enable row level security;

create index wa_log_tenant_created_idx on whatsapp_message_log(tenant_id, created_at desc);
create index wa_log_user_idx           on whatsapp_message_log(user_id) where user_id is not null;

-- whatsapp_templates: catálogo de HSM templates por tenant (null = global)
create table whatsapp_templates (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid references tenants(id) on delete restrict,
    nombre         text not null,
    categoria      text not null default 'UTILITY',
    idioma         text not null default 'es_AR',
    body_template  text not null,
    variables      jsonb not null default '[]',
    aprobado       boolean not null default false,
    is_active      boolean not null default true,
    created_at     timestamptz not null default now(),
    constraint wa_templates_categoria_check check (categoria in ('UTILITY', 'MARKETING', 'AUTHENTICATION'))
);

alter table whatsapp_templates enable row level security;

-- Seed: templates globales de HRConnect
insert into whatsapp_templates (nombre, categoria, body_template, variables, aprobado) values
(
    'nuevo_recibo_disponible',
    'UTILITY',
    'Hola {{1}}, tenés un recibo de sueldo disponible correspondiente a {{2}}. Respondé *VER* para verlo o *MENU* para más opciones.',
    '[{"pos": 1, "desc": "nombre del colaborador"}, {"pos": 2, "desc": "período (ej: Abril 2026)"}]',
    true
),
(
    'recordatorio_firma_recibo',
    'UTILITY',
    'Hola {{1}}, recordamos que tenés un recibo de {{2}} pendiente de firma. Respondé *VER* para firmarlo.',
    '[{"pos": 1, "desc": "nombre del colaborador"}, {"pos": 2, "desc": "período"}]',
    true
),
(
    'invitacion_activacion',
    'UTILITY',
    'Hola {{1}}, tu cuenta en HRConnect está lista. Activala en: {{2}}',
    '[{"pos": 1, "desc": "nombre del colaborador"}, {"pos": 2, "desc": "URL de activación"}]',
    true
),
(
    'licencia_aprobada',
    'UTILITY',
    'Hola {{1}}, tu solicitud de licencia del {{2}} al {{3}} fue *aprobada*. ¡Buen descanso!',
    '[{"pos": 1, "desc": "nombre"}, {"pos": 2, "desc": "fecha inicio"}, {"pos": 3, "desc": "fecha fin"}]',
    true
),
(
    'licencia_rechazada',
    'UTILITY',
    'Hola {{1}}, lamentablemente tu solicitud de licencia del {{2}} al {{3}} fue *rechazada*. Motivo: {{4}}.',
    '[{"pos": 1, "desc": "nombre"}, {"pos": 2, "desc": "fecha inicio"}, {"pos": 3, "desc": "fecha fin"}, {"pos": 4, "desc": "motivo"}]',
    true
);
