-- Sản xuất: cấu trúc sản phẩm (BOM). Mỗi sản phẩm (vật tư thành phẩm / bán thành phẩm) có một cấu trúc (erp_product_structure; khóa code = mã vật tư,
-- material_code giữ tham chiếu tới vật tư), gồm các dòng định mức vật tư (erp_product_structure_line): vật tư thành phần, đơn vị tính,
-- công đoạn tiêu hao, số lượng, hao hụt (%). Một thành phần có cấu trúc riêng thì tạo thành cây.
-- Không khóa ngoại: dịch vụ kiểm tra mã khi lưu. Chạy lại được.
CREATE TABLE IF NOT EXISTS erp_product_structure (
    code varchar(50) PRIMARY KEY,
    material_code varchar(50) NOT NULL,
    note varchar(300),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer
);
CREATE INDEX IF NOT EXISTS ix_erp_product_structure_material_code ON erp_product_structure (material_code);

CREATE TABLE IF NOT EXISTS erp_product_structure_line (
    product_structure_code varchar(50) NOT NULL,
    line_no integer NOT NULL,
    component_material_code varchar(50) NOT NULL,
    uom_code varchar(20) NOT NULL,
    production_operation_code varchar(20),
    quantity numeric(18,4) NOT NULL,
    scrap_percent numeric(9,4) NOT NULL DEFAULT 0,
    note varchar(300),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    PRIMARY KEY (product_structure_code, line_no),
    CONSTRAINT ck_erp_product_structure_line_quantity CHECK (quantity > 0),
    CONSTRAINT ck_erp_product_structure_line_scrap CHECK (scrap_percent >= 0 AND scrap_percent < 100)
);
-- Tra "vật tư này nằm trong cấu trúc nào" (tìm mẹ - con) và chặn xóa vật tư, đơn vị tính, công đoạn còn dùng.
CREATE INDEX IF NOT EXISTS ix_erp_product_structure_line_component_material_code ON erp_product_structure_line (component_material_code);
CREATE INDEX IF NOT EXISTS ix_erp_product_structure_line_uom_code ON erp_product_structure_line (uom_code);
CREATE INDEX IF NOT EXISTS ix_erp_product_structure_line_production_operation_code ON erp_product_structure_line (production_operation_code) WHERE production_operation_code IS NOT NULL;
