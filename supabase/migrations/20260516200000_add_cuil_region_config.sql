-- CUIL region config: one record per tenant defining where the CUIL lives in payslip PDFs
create table cuil_region_config (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null unique references tenants(id) on delete cascade,
  page_number   int         not null default 1 check (page_number >= 1),
  x0            float       not null,
  y0            float       not null,
  x1            float       not null,
  y1            float       not null,
  sample_pdf_path text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table cuil_region_config enable row level security;

create or replace function set_updated_at_cuil_region_config()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_cuil_region_config_updated_at
  before update on cuil_region_config
  for each row execute function set_updated_at_cuil_region_config();
