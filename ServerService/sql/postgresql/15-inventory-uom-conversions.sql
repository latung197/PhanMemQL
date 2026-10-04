-- Inventory: unit conversion catalog. Safe to rerun.
-- Material codes are optional until the material catalog moves to the backend.
CREATE TABLE IF NOT EXISTS erp_uom_conversion (
    code varchar(40) PRIMARY KEY,
    material_code varchar(50),
    material_name varchar(200),
    from_uom_code varchar(20) NOT NULL,
    to_uom_code varchar(20) NOT NULL,
    factor numeric(20, 8) NOT NULL CHECK (factor > 0),
    note varchar(300),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    CONSTRAINT ck_erp_uom_conversion_units CHECK (from_uom_code <> to_uom_code)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_uom_conversion_pair
    ON erp_uom_conversion (coalesce(material_code, ''), from_uom_code, to_uom_code);
CREATE INDEX IF NOT EXISTS ix_erp_uom_conversion_from ON erp_uom_conversion (from_uom_code);
CREATE INDEX IF NOT EXISTS ix_erp_uom_conversion_to ON erp_uom_conversion (to_uom_code);
CREATE INDEX IF NOT EXISTS ix_erp_uom_conversion_material ON erp_uom_conversion (material_code);
