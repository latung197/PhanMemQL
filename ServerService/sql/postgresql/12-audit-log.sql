-- System: change log shared by every function (who changed what, when, from which unit and address).
-- Safe to rerun. Rows are only inserted by the API (IAuditLog), in the same transaction as the change itself,
-- and never updated or deleted by it.

CREATE TABLE IF NOT EXISTS sys_audit_log (
    id bigserial PRIMARY KEY,
    log_time timestamp without time zone NOT NULL DEFAULT now(),  -- local time, like the other sys_* tables
    function_code varchar(64) NOT NULL,     -- function (SubMenuKey) whose screen made the change, e.g. sys_users
    object_type varchar(50) NOT NULL,       -- what was changed: user, role, approvalRule, inv_receipt...
    object_id varchar(64) NOT NULL,         -- its id or code
    object_label varchar(300),              -- readable name when the change was made (@username, role name...)
    action varchar(30) NOT NULL,            -- CREATE, UPDATE, DELETE, PERMISSIONS, RESET_PASSWORD, SYNC...
    changes jsonb NOT NULL DEFAULT '[]',    -- [{ "field": "...", "before": "...", "after": "..." }]
    note varchar(1000),
    actor_id integer,                       -- sys_users.user_id; null for system jobs
    actor_username varchar(50),
    actor_name varchar(100),
    unit_code varchar(20),                  -- company unit of the actor's session
    ip_address varchar(64)
);

CREATE INDEX IF NOT EXISTS ix_sys_audit_log_object ON sys_audit_log (object_type, object_id, log_time DESC);
CREATE INDEX IF NOT EXISTS ix_sys_audit_log_function ON sys_audit_log (function_code, log_time DESC);
CREATE INDEX IF NOT EXISTS ix_sys_audit_log_actor ON sys_audit_log (actor_id, log_time DESC);
