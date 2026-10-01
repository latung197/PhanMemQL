-- System: languages of the user interface and of translated data. Safe to rerun. Run after 01-users.sql.
-- Adding a language here makes it selectable; its screen texts come from Frontend/src/locales/<code>.json and the
-- backend messages from Core.Application/Common/Localization/Messages.<code>.json (missing texts fall back to the
-- default language).

CREATE TABLE IF NOT EXISTS sys_language (
    code varchar(10) PRIMARY KEY,          -- vi, en, ja, zh-cn...
    name varchar(50) NOT NULL,             -- name shown in the default language, e.g. "Tiếng Anh"
    native_name varchar(50) NOT NULL,      -- name in the language itself, e.g. "English"
    is_active boolean NOT NULL DEFAULT true,
    is_default boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0
);
-- Exactly one default language: used for users without their own choice and when a translation is missing.
CREATE UNIQUE INDEX IF NOT EXISTS ux_sys_language_default ON sys_language (is_default) WHERE is_default;

INSERT INTO sys_language (code, name, native_name, is_active, is_default, sort_order)
SELECT 'vi', 'Tiếng Việt', 'Tiếng Việt', true, NOT EXISTS (SELECT 1 FROM sys_language WHERE is_default), 1
WHERE NOT EXISTS (SELECT 1 FROM sys_language WHERE code = 'vi');
INSERT INTO sys_language (code, name, native_name, is_active, is_default, sort_order)
VALUES ('en', 'Tiếng Anh', 'English', true, false, 2)
ON CONFLICT (code) DO NOTHING;

-- The user's own language; null = the default language of the company.
ALTER TABLE sys_users ADD COLUMN IF NOT EXISTS language varchar(10);
CREATE INDEX IF NOT EXISTS ix_sys_users_language ON sys_users (language);
