-- Kho: đơn vị cơ sở của kho (unit_code, một đơn vị). Kho mới lấy mặc định đơn vị cơ sở đang đăng nhập lúc tạo.
-- Khác danh sách đơn vị được dùng kho (erp_warehouse_unit, để trống = dùng chung). Chạy sau 25-inventory-warehouse-units.sql.
-- Kho đã có: lấy đơn vị nhỏ nhất trong danh sách được dùng kho, nếu kho dùng chung thì lấy đơn vị cơ sở đầu tiên. Chạy lại được.
ALTER TABLE erp_warehouse ADD COLUMN IF NOT EXISTS unit_code varchar(20);

UPDATE erp_warehouse w
SET unit_code = COALESCE(
    (SELECT min(u.unit_code) FROM erp_warehouse_unit u WHERE u.warehouse_code = w.code),
    (SELECT c.code FROM sys_company_unit c ORDER BY c.is_active DESC, c.code LIMIT 1))
WHERE w.unit_code IS NULL OR w.unit_code = '';

UPDATE erp_warehouse SET unit_code = '' WHERE unit_code IS NULL;
ALTER TABLE erp_warehouse ALTER COLUMN unit_code SET DEFAULT '';
ALTER TABLE erp_warehouse ALTER COLUMN unit_code SET NOT NULL;

-- Tra kho theo đơn vị cơ sở và chặn xóa đơn vị cơ sở còn kho (sys_table_ref).
CREATE INDEX IF NOT EXISTS ix_erp_warehouse_unit_code ON erp_warehouse (unit_code);
