-- Kho: danh mục vật tư (erp_material). Chạy lại được; chạy sau 24-table-ref.sql, 28-inventory-material-types.sql, 29-system-tax-rates.sql.
-- Phần lõi cho nghiệp vụ kho: loại / nhóm, đơn vị tính gốc, thuế, các cờ quản lý tồn kho (theo lô, theo vị trí, có hạn dùng,
-- kiểm kê), phương pháp tính giá tồn, định mức tồn và kích thước. Giá bán, khấu hao, BOM... thêm sau khi làm bán hàng / sản xuất.
-- Cột *_code trỏ danh mục khác không có khóa ngoại; dịch vụ kiểm tra mã khi lưu và chặn xóa danh mục còn dùng (sys_table_ref).
CREATE TABLE IF NOT EXISTS erp_material (
    code varchar(50) PRIMARY KEY,
    name varchar(200) NOT NULL,
    customer_material_code varchar(50),
    part_no varchar(50),
    material_type_code varchar(20),
    material_group_code varchar(20),
    uom_code varchar(20) NOT NULL,
    vat_tax_rate_code varchar(20),
    import_tax_rate_code varchar(20),
    is_stock_item boolean NOT NULL DEFAULT true,
    track_lot boolean NOT NULL DEFAULT false,
    has_expiry boolean NOT NULL DEFAULT false,
    shelf_life_days integer,
    track_location boolean NOT NULL DEFAULT false,
    is_cycle_counted boolean NOT NULL DEFAULT false,
    costing_method varchar(10) NOT NULL DEFAULT 'AVERAGE',
    min_stock numeric(18,4),
    max_stock numeric(18,4),
    length numeric(18,4),
    width numeric(18,4),
    height numeric(18,4),
    weight numeric(18,4),
    volume numeric(18,4),
    note varchar(500),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    CONSTRAINT ck_erp_material_costing CHECK (costing_method IN ('AVERAGE', 'FIFO')),
    CONSTRAINT ck_erp_material_stock CHECK (min_stock IS NULL OR min_stock >= 0),
    CONSTRAINT ck_erp_material_stock_max CHECK (max_stock IS NULL OR min_stock IS NULL OR max_stock >= min_stock),
    CONSTRAINT ck_erp_material_shelf CHECK (shelf_life_days IS NULL OR shelf_life_days > 0)
);
-- Mỗi cột trỏ danh mục khác có index bắt đầu bằng chính cột đó (xóa danh mục đích tra cột này).
CREATE INDEX IF NOT EXISTS ix_erp_material_material_type_code ON erp_material (material_type_code);
CREATE INDEX IF NOT EXISTS ix_erp_material_material_group_code ON erp_material (material_group_code);
CREATE INDEX IF NOT EXISTS ix_erp_material_uom_code ON erp_material (uom_code);
CREATE INDEX IF NOT EXISTS ix_erp_material_vat_tax_rate_code ON erp_material (vat_tax_rate_code);
CREATE INDEX IF NOT EXISTS ix_erp_material_import_tax_rate_code ON erp_material (import_tax_rate_code);
