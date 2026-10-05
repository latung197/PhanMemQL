-- Supplier catalog. Safe to rerun.
CREATE TABLE IF NOT EXISTS erp_supplier (
    code varchar(20) PRIMARY KEY,
    name varchar(200) NOT NULL,
    tax_code varchar(30),
    phone varchar(30),
    address varchar(300),
    note varchar(300),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_supplier_name ON erp_supplier (lower(name));
CREATE INDEX IF NOT EXISTS ix_erp_supplier_tax_code ON erp_supplier (tax_code);
