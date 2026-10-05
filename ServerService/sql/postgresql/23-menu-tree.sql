-- The function code in sys_command.menuid0 remains the permission key.
-- Module and group rows use their stable IDs as menuid0. Their menu_kind prevents
-- them from being treated as functions by the application permission catalog.
ALTER TABLE sys_command ADD COLUMN IF NOT EXISTS menu_kind varchar(16);
ALTER TABLE sys_command ADD COLUMN IF NOT EXISTS menu_key varchar(64);
ALTER TABLE sys_command ADD COLUMN IF NOT EXISTS menu_parent_id varchar(64);
ALTER TABLE sys_command ADD COLUMN IF NOT EXISTS menu_icon varchar(64) NOT NULL DEFAULT '';
ALTER TABLE sys_command ADD COLUMN IF NOT EXISTS menu_icon_color varchar(64);
ALTER TABLE sys_command ADD COLUMN IF NOT EXISTS menu_badge_type varchar(32);
ALTER TABLE sys_command ADD COLUMN IF NOT EXISTS menu_direct_function_code varchar(64);
ALTER TABLE sys_command ADD COLUMN IF NOT EXISTS menu_order_no integer NOT NULL DEFAULT 0;
ALTER TABLE sys_command ADD COLUMN IF NOT EXISTS menu_is_active boolean NOT NULL DEFAULT true;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_sys_command_menu_kind') THEN
        ALTER TABLE sys_command ADD CONSTRAINT ck_sys_command_menu_kind
            CHECK (menu_kind IS NULL OR menu_kind IN ('module', 'group', 'function'));
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS ix_sys_command_menu_parent ON sys_command (menu_parent_id, menu_order_no);

-- Translations are rows, so adding a language never adds a column.
CREATE TABLE IF NOT EXISTS sys_command_translation (
    menuid0 varchar(64) NOT NULL,
    language_code varchar(10) NOT NULL,
    title varchar(200) NOT NULL,
    PRIMARY KEY (menuid0, language_code)
);

-- Upgrade installations that already ran the earlier sys_menu_node migration.
-- Preserve existing hide_yn and all permission records attached to function codes.
DO $$
BEGIN
    IF to_regclass('sys_menu_node') IS NOT NULL THEN
        INSERT INTO sys_command (menuid0, menuid, text, text2, type,
            menu_kind, menu_key, menu_parent_id, menu_icon, menu_icon_color,
            menu_badge_type, menu_direct_function_code, menu_order_no, menu_is_active)
        SELECT CASE WHEN node_type = 'function' THEN code ELSE id END,
            CASE WHEN node_type = 'function' THEN code ELSE id END,
            left(title_vi, 100), left(title_en, 100), 'M',
            node_type, code, parent_id, icon, icon_color,
            badge_type, direct_function_code, order_no, is_active
        FROM sys_menu_node
        ON CONFLICT (menuid0) DO UPDATE SET
            text = EXCLUDED.text, text2 = EXCLUDED.text2,
            menu_kind = EXCLUDED.menu_kind, menu_key = EXCLUDED.menu_key,
            menu_parent_id = EXCLUDED.menu_parent_id, menu_icon = EXCLUDED.menu_icon,
            menu_icon_color = EXCLUDED.menu_icon_color, menu_badge_type = EXCLUDED.menu_badge_type,
            menu_direct_function_code = EXCLUDED.menu_direct_function_code,
            menu_order_no = EXCLUDED.menu_order_no, menu_is_active = EXCLUDED.menu_is_active;

        INSERT INTO sys_command_translation (menuid0, language_code, title)
        SELECT CASE WHEN node_type = 'function' THEN code ELSE id END, 'vi', title_vi
        FROM sys_menu_node
        ON CONFLICT (menuid0, language_code) DO UPDATE SET title = EXCLUDED.title;
        INSERT INTO sys_command_translation (menuid0, language_code, title)
        SELECT CASE WHEN node_type = 'function' THEN code ELSE id END, 'en', title_en
        FROM sys_menu_node
        ON CONFLICT (menuid0, language_code) DO UPDATE SET title = EXCLUDED.title;

        DROP TABLE sys_menu_node;
    END IF;
END $$;
