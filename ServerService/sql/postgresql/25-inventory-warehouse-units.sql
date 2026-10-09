-- Đơn vị cơ sở được dùng mỗi kho (chọn nhiều). Kho không có dòng nào ở đây thì mọi đơn vị cơ sở đều dùng được (kho dùng chung).
-- Kho đã có giữ nguyên: chưa chọn đơn vị nên vẫn dùng chung. Chạy lại được.
CREATE TABLE IF NOT EXISTS erp_warehouse_unit (
    warehouse_code varchar(20) NOT NULL,
    unit_code varchar(20) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    PRIMARY KEY (warehouse_code, unit_code)
);
-- Xóa một đơn vị cơ sở tra theo unit_code; khóa chính chỉ phục vụ tra theo kho.
CREATE INDEX IF NOT EXISTS ix_erp_warehouse_unit_unit ON erp_warehouse_unit (unit_code);
