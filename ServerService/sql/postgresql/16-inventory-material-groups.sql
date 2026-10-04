-- Inventory: material groups. Safe to rerun.
CREATE TABLE IF NOT EXISTS erp_material_group (
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_material_group_name ON erp_material_group (lower(name));
