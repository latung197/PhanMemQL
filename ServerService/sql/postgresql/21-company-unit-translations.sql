-- Translated display names for company units. sys_company_unit.name remains the Vietnamese fallback.
CREATE TABLE IF NOT EXISTS sys_company_unit_translation (
    unit_code varchar(20) NOT NULL,
    language_code varchar(10) NOT NULL,
    name varchar(150) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    PRIMARY KEY (unit_code, language_code)
);
CREATE INDEX IF NOT EXISTS ix_sys_company_unit_translation_language
    ON sys_company_unit_translation (language_code);
