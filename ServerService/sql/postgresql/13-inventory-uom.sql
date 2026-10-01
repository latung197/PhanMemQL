-- Inventory: unit of measure catalog (danh mục đơn vị tính, function inv_uom_cat). Safe to rerun.
-- Materials, unit conversions and voucher lines will link to a unit by its code.

CREATE TABLE IF NOT EXISTS erp_uom (
    code varchar(20) PRIMARY KEY,           -- CAI, KG, THUNG...
    name varchar(100) NOT NULL,             -- Cái, Kilogram, Thùng
    symbol varchar(20) NOT NULL DEFAULT '', -- printed after quantities: cái, kg, m
    note varchar(300),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    -- Record stamps of every erp_* table (ErpEntity): filled by the API on save, UTC.
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,                     -- sys_users.user_id; null for rows created by scripts
    updated_at timestamptz,
    updated_by integer
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_uom_name ON erp_uom (lower(name));

-- Databases created before the record stamps.
ALTER TABLE erp_uom ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE erp_uom ADD COLUMN IF NOT EXISTS created_by integer;
ALTER TABLE erp_uom ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE erp_uom ADD COLUMN IF NOT EXISTS updated_by integer;

-- Usual units for a new database (only while the catalog is empty, so deleted units do not come back on a rerun).
INSERT INTO erp_uom (code, name, symbol, note, sort_order)
SELECT v.code, v.name, v.symbol, v.note, v.sort_order
FROM (VALUES
    ('CAI', 'Cái', 'cái', 'Đơn vị đếm tiêu chuẩn', 1),
    ('CHIEC', 'Chiếc', 'chiếc', 'Thiết bị hoàn chỉnh', 2),
    ('BO', 'Bộ', 'bộ', 'Bộ sản phẩm, phụ kiện đi kèm', 3),
    ('HOP', 'Hộp', 'hộp', 'Đóng gói quy cách vừa', 4),
    ('THUNG', 'Thùng', 'thùng', 'Đóng gói quy cách lớn', 5),
    ('KG', 'Kilogram', 'kg', 'Khối lượng', 6),
    ('MET', 'Mét', 'm', 'Chiều dài', 7),
    ('LIT', 'Lít', 'l', 'Thể tích', 8)
) AS v(code, name, symbol, note, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM erp_uom);
