-- Translated unit names; erp_uom.name is the Vietnamese fallback.
CREATE TABLE IF NOT EXISTS erp_uom_translation (
    uom_code varchar(20) NOT NULL,
    language_code varchar(10) NOT NULL,
    name varchar(100) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    PRIMARY KEY (uom_code, language_code)
);
CREATE INDEX IF NOT EXISTS ix_erp_uom_translation_language ON erp_uom_translation (language_code);
