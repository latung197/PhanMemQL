-- System: permission exceptions. Safe to rerun. Run after 01-users.sql.
--
-- Rights model: a user has the rights of their roles; the user's own rows are exceptions.
--   sys_user_command: a row replaces the role rights of that one function (other functions follow the role).
--   sys_user_right:   is_granted = true adds a special right, false takes away one the role gives.
-- Before this script an own matrix replaced the whole role matrix, and the own special rights replaced
-- the role's. The one-time conversion below keeps everybody's effective rights exactly as they were.

ALTER TABLE sys_user_right ADD COLUMN IF NOT EXISTS is_granted boolean NOT NULL DEFAULT true;

-- One-time data conversions already applied to this database.
CREATE TABLE IF NOT EXISTS sys_migration (
    name varchar(100) PRIMARY KEY,
    applied_at_utc timestamp with time zone NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM sys_migration WHERE name = 'permission_exceptions') THEN
        RETURN;
    END IF;

    -- Users that had an own matrix.
    CREATE TEMP TABLE own_users ON COMMIT DROP AS
    SELECT DISTINCT user_id FROM sys_user_command WHERE status = '1';

    -- Combined role matrix of those users, as the five actions of the frontend.
    CREATE TEMP TABLE role_matrix ON COMMIT DROP AS
    SELECT ur.user_id, rc.menuid0,
           bool_or(rc.can_view) AS v, bool_or(rc.can_add OR rc.can_edit) AS ce, bool_or(rc.can_delete) AS d,
           bool_or(rc.can_approve) AS a, bool_or(rc.can_print OR rc.can_export) AS pe
    FROM sys_user_role ur
    JOIN sys_role r ON r.role_id = ur.role_id AND r.validflg = 1
    JOIN sys_role_command rc ON rc.role_id = ur.role_id AND rc.status = '1'
    WHERE ur.status = '1' AND ur.user_id IN (SELECT user_id FROM own_users)
    GROUP BY ur.user_id, rc.menuid0;

    -- Role special rights of those users.
    CREATE TEMP TABLE role_rights ON COMMIT DROP AS
    SELECT DISTINCT ur.user_id, rr.menuid0, rr.right_code
    FROM sys_user_role ur
    JOIN sys_role r ON r.role_id = ur.role_id AND r.validflg = 1
    JOIN sys_role_right rr ON rr.role_id = ur.role_id AND rr.status = '1'
    WHERE ur.status = '1' AND ur.user_id IN (SELECT user_id FROM own_users);

    -- 1. A function the role grants but the own matrix did not list had no rights: store "no rights".
    INSERT INTO sys_user_command (user_id, menuid0, status)
    SELECT m.user_id, m.menuid0, '1' FROM role_matrix m
    WHERE (m.v OR m.ce OR m.d OR m.a OR m.pe)
      AND NOT EXISTS (SELECT 1 FROM sys_user_command uc
                      WHERE uc.user_id = m.user_id AND uc.menuid0 = m.menuid0 AND uc.status = '1')
    ON CONFLICT (user_id, menuid0) DO UPDATE SET status = '1',
        can_view = false, can_add = false, can_edit = false, can_delete = false, can_print = false, can_import = false,
        can_export = false, can_search = false, can_reload = false, can_copy = false, can_approve = false;

    -- 2. Own rows equal to the role matrix are not exceptions.
    DELETE FROM sys_user_command uc
    WHERE uc.status = '1' AND uc.user_id IN (SELECT user_id FROM own_users)
      AND uc.can_view = coalesce((SELECT m.v FROM role_matrix m WHERE m.user_id = uc.user_id AND m.menuid0 = uc.menuid0), false)
      AND (uc.can_add OR uc.can_edit) = coalesce((SELECT m.ce FROM role_matrix m WHERE m.user_id = uc.user_id AND m.menuid0 = uc.menuid0), false)
      AND uc.can_delete = coalesce((SELECT m.d FROM role_matrix m WHERE m.user_id = uc.user_id AND m.menuid0 = uc.menuid0), false)
      AND uc.can_approve = coalesce((SELECT m.a FROM role_matrix m WHERE m.user_id = uc.user_id AND m.menuid0 = uc.menuid0), false)
      AND (uc.can_print OR uc.can_export) = coalesce((SELECT m.pe FROM role_matrix m WHERE m.user_id = uc.user_id AND m.menuid0 = uc.menuid0), false);

    -- 3. Users without an own matrix used the role rights only; their own special right rows had no effect.
    DELETE FROM sys_user_right x WHERE x.user_id NOT IN (SELECT user_id FROM own_users);

    -- 4. For users with an own matrix the own rights replaced the role's: take away role rights they lacked...
    INSERT INTO sys_user_right (user_id, menuid0, right_code, is_granted, status)
    SELECT rr.user_id, rr.menuid0, rr.right_code, false, '1' FROM role_rights rr
    WHERE NOT EXISTS (SELECT 1 FROM sys_user_right x WHERE x.user_id = rr.user_id AND x.menuid0 = rr.menuid0
                      AND x.right_code = rr.right_code AND x.status = '1')
    ON CONFLICT (user_id, menuid0, right_code) DO UPDATE SET is_granted = false, status = '1';

    -- ...and drop own grants the role gives anyway.
    DELETE FROM sys_user_right x
    WHERE x.is_granted AND EXISTS (SELECT 1 FROM role_rights rr
        WHERE rr.user_id = x.user_id AND rr.menuid0 = x.menuid0 AND rr.right_code = x.right_code);

    INSERT INTO sys_migration (name) VALUES ('permission_exceptions');
END $$;
