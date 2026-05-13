create table upload_jobs (
  id           uuid        primary key,
  tenant_id    uuid        not null,
  periodo_id   uuid        not null,
  files        jsonb       not null default '[]',
  expires_at   timestamptz not null default now() + interval '1 hour',
  created_at   timestamptz not null default now()
);

alter table upload_jobs enable row level security;
