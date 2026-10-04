-- Warehouse types and their translated names. Existing warehouses keep a null type.
CREATE TABLE IF NOT EXISTS erp_warehouse_type (
    code varchar(20) PRIMARY KEY,
    name varchar(100) NOT NULL,
    note varchar(300),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_warehouse_type_name ON erp_warehouse_type (lower(name));

CREATE TABLE IF NOT EXISTS erp_warehouse_type_translation (
    warehouse_type_code varchar(20) NOT NULL,
    language_code varchar(10) NOT NULL,
    name varchar(100) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    PRIMARY KEY (warehouse_type_code, language_code)
);
CREATE INDEX IF NOT EXISTS ix_erp_warehouse_type_translation_language
    ON erp_warehouse_type_translation (language_code);

ALTER TABLE erp_warehouse ADD COLUMN IF NOT EXISTS warehouse_type_code varchar(20);
CREATE INDEX IF NOT EXISTS ix_erp_warehouse_type_code ON erp_warehouse (warehouse_type_code);
