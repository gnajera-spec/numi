-- Refresh tokens almacenados hasheados para soporte de logout
create table refresh_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete restrict,
  token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),

  constraint refresh_tokens_hash_unique unique (token_hash)
);

create index refresh_tokens_user_idx on refresh_tokens(user_id);
create index refresh_tokens_hash_idx on refresh_tokens(token_hash);

alter table refresh_tokens enable row level security;
