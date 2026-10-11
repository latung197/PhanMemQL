-- System: pictures for the login screen notices, a pinned flag and a BACKGROUND notice kind. Safe to rerun. Run after 36-login-notices.sql.
-- A picture is stored in the database (small, compressed by the browser before upload); the notice points to it with login_image_code.
CREATE TABLE IF NOT EXISTS sys_login_image (
    code varchar(40) PRIMARY KEY,
    content_type varchar(30) NOT NULL,
    size_bytes integer NOT NULL,
    data bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer
);

ALTER TABLE sys_login_notice ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;
ALTER TABLE sys_login_notice ADD COLUMN IF NOT EXISTS login_image_code varchar(40);
CREATE INDEX IF NOT EXISTS ix_sys_login_notice_login_image_code ON sys_login_notice (login_image_code);

-- Kind BACKGROUND: no text shown, its picture becomes the background of the login screen while it is in force.
ALTER TABLE sys_login_notice DROP CONSTRAINT IF EXISTS ck_sys_login_notice_kind;
ALTER TABLE sys_login_notice ADD CONSTRAINT ck_sys_login_notice_kind
    CHECK (kind IN ('INFO', 'WELCOME', 'MAINTENANCE', 'RULE', 'BACKGROUND'));
