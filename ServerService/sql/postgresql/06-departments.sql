-- System: department catalog (danh mục phòng ban). Safe to rerun. Run after 01-users.sql and 05-approvals.sql.
-- Users and approval rules (requester type DEPARTMENT) link to a department by its code.

CREATE TABLE IF NOT EXISTS sys_department (
    code varchar(20) PRIMARY KEY,
    name varchar(100) NOT NULL,
    note varchar(300),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sys_department_name ON sys_department (lower(name));

-- sys_users.department keeps the name (for display); department_code is the link.
ALTER TABLE sys_users ADD COLUMN IF NOT EXISTS department_code varchar(20);
CREATE INDEX IF NOT EXISTS ix_sys_users_department ON sys_users (department_code);

-- Older databases only had the department name on the user: create a department (PB01, PB02...)
-- for every name in use, then link the users and the approval rules to it.
WITH names AS (
    SELECT DISTINCT trim(u.department) AS name
    FROM sys_users u
    WHERE u.department_code IS NULL AND trim(u.department) <> ''
      AND NOT EXISTS (SELECT 1 FROM sys_department d WHERE lower(d.name) = lower(trim(u.department)))
), numbered AS (
    SELECT name, (SELECT count(*) FROM sys_department) + row_number() OVER (ORDER BY name) AS n FROM names
)
INSERT INTO sys_department (code, name, sort_order)
SELECT 'PB' || lpad(n::text, 2, '0'), name, n FROM numbered
ON CONFLICT (code) DO NOTHING;

UPDATE sys_users u SET department_code = d.code, department = d.name
FROM sys_department d
WHERE u.department_code IS NULL AND lower(trim(u.department)) = lower(d.name);

UPDATE sys_approval_rule r SET requester_value = d.code
FROM sys_department d
WHERE r.requester_type = 'DEPARTMENT' AND lower(trim(r.requester_value)) = lower(d.name);
