-- Warehouse catalog. Safe to rerun.
CREATE TABLE IF NOT EXISTS erp_warehouse (
    code varchar(20) PRIMARY KEY,
    name varchar(100) NOT NULL,
    address varchar(300),
    manager varchar(100),
    capacity varchar(100),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_warehouse_name ON erp_warehouse (lower(name));
