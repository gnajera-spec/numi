-- Add roles text[] column to support multi-role users.
-- The existing `role` column stays as the "primary" role (portal entry point).
-- `roles` holds the full set; initialized from `role`.
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles text[] NOT NULL DEFAULT '{}';
UPDATE users SET roles = ARRAY[role::text] WHERE cardinality(roles) = 0;
