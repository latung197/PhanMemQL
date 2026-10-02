-- How each list (lưới) is shown: visible columns, their order and width, sort, rows per page. Safe to rerun.
-- One row per user and list; user_id NULL = the company default set by an administrator. The columns themselves are
-- defined in the code (frontend catalog definitions); a key that no longer exists is simply ignored.

CREATE TABLE IF NOT EXISTS sys_grid_layout (
    id bigserial PRIMARY KEY,
    function_code varchar(64) NOT NULL,     -- SubMenuKey of the screen (inv_uom_cat...)
    grid_key varchar(64) NOT NULL DEFAULT 'main',  -- a screen with several lists names each one
    user_id integer,                        -- sys_users.user_id; NULL = company default
    layout jsonb NOT NULL,                  -- { columns: [{ key, visible, width }], sortKey, sortDir, pageSize }
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by integer
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sys_grid_layout ON sys_grid_layout (function_code, grid_key, COALESCE(user_id, 0));
