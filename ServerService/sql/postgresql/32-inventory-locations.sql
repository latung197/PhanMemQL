-- Kho: danh mục vị trí lưu kho (erp_location). Chạy lại được; chạy sau 17-inventory-warehouses.sql.
-- Mã vị trí duy nhất toàn hệ thống (ví dụ KHO1-A-01); mỗi vị trí thuộc một kho. Số lượng đang chứa lấy từ sổ kho, không lưu ở đây.
CREATE TABLE IF NOT EXISTS erp_location (
    code varchar(30) PRIMARY KEY,
    name varchar(100) NOT NULL,
    warehouse_code varchar(20) NOT NULL,
    zone varchar(50),
    rack varchar(50),
    shelf varchar(50),
    capacity numeric(18,4),
    note varchar(300),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    CONSTRAINT ck_erp_location_capacity CHECK (capacity IS NULL OR capacity >= 0)
);
-- Tên vị trí không trùng trong cùng một kho.
CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_location_warehouse_name ON erp_location (warehouse_code, lower(name));
CREATE INDEX IF NOT EXISTS ix_erp_location_warehouse_code ON erp_location (warehouse_code);
