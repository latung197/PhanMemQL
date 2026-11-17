-- API clients: machines (robots, other systems) that call the API with a key instead of a user name and password.
-- Safe to rerun. docs/he-thong/tich-hop-api-key.md
--
-- A client is bound to a service account (a sys_users row flagged is_service_account: it cannot sign in with a password, has no
-- idle sign-out and no password expiry); its roles / rights / units are the account's, so permissions, audit trail, month locks and
-- "created by" work exactly as for a person. The key is shown once when created and only its SHA-256 hash is kept.

ALTER TABLE sys_users ADD COLUMN IF NOT EXISTS is_service_account ud_bool NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS sys_api_client (
    code ud_code30 PRIMARY KEY,
    name ud_text200 NOT NULL,
    user_id ud_user_id NOT NULL,              -- the service account the key acts as
    unit_code ud_code20 NOT NULL,             -- company unit every call works in
    scope ud_code20 NOT NULL DEFAULT 'TRANSFER', -- which APIs the key may call (see ApiKeyScopes in code)
    key_prefix ud_code10 NOT NULL,            -- first characters of the key, to recognise it in lists
    key_hash ud_code64 NOT NULL,              -- SHA-256 (hex) of the key
    allowed_ips ud_text500,                   -- addresses or CIDR ranges separated by commas; empty = any address
    expires_at ud_timestamptz,
    is_active ud_bool NOT NULL DEFAULT true,
    last_used_at ud_timestamptz,
    last_used_ip ud_code50,
    note ud_text300,
    created_at ud_timestamptz NOT NULL DEFAULT now(),
    created_by ud_user_id,
    updated_at ud_timestamptz,
    updated_by ud_user_id
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sys_api_client_key_hash ON sys_api_client (key_hash);
CREATE INDEX IF NOT EXISTS ix_sys_api_client_user_id ON sys_api_client (user_id);
CREATE INDEX IF NOT EXISTS ix_sys_api_client_unit_code ON sys_api_client (unit_code);

-- Replies kept for the Idempotency-Key header: the same key sent again gets the same reply and does the work once.
-- Written with SQL only (no entity); rows older than a week are purged by the writer.
CREATE TABLE IF NOT EXISTS sys_idempotency_key (
    id bigserial PRIMARY KEY,
    client_code ud_code30 NOT NULL,
    key ud_text200 NOT NULL,
    request_hash ud_code64 NOT NULL,          -- method + path + body: the same key with another request is refused
    state ud_smallint NOT NULL DEFAULT 0,     -- 0 running, 1 done
    response_status ud_smallint,
    response_type ud_text100,
    response_body text,
    created_at ud_timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sys_idempotency_key ON sys_idempotency_key (client_code, key);
CREATE INDEX IF NOT EXISTS ix_sys_idempotency_key_created_at ON sys_idempotency_key (created_at);
