-- Kho: dòng phiếu nhập / xuất trỏ tới danh mục thật. Chạy lại được; chạy sau 20, 34 và 39.
--   erp_goods_receipt_line / erp_goods_issue_line:  product_code -> material_code (danh mục vật tư erp_material),
--                                                   product_name -> material_name (tên vật tư lúc lưu phiếu),
--                                                   unit         -> uom_code      (danh mục đơn vị tính erp_uom).
--   erp_goods_receipt:                              thêm supplier_code (danh mục nhà cung cấp erp_supplier, không bắt buộc);
--                                                   supplier_name giữ tên lúc lưu hoặc chữ tự do khi không chọn từ danh mục.
-- Mỗi cột *_code trỏ danh mục khác có chỉ mục bắt đầu bằng chính cột đó (xóa vật tư / đơn vị tính / nhà cung cấp tra cột này).
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['erp_goods_receipt_line', 'erp_goods_issue_line'] LOOP
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'product_code') THEN
            PERFORM sys_rename_column(t, 'product_code', 'material_code');
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'product_name') THEN
            PERFORM sys_rename_column(t, 'product_name', 'material_name');
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'unit') THEN
            PERFORM sys_rename_column(t, 'unit', 'uom_code');
        END IF;
    END LOOP;
END $$;

ALTER TABLE erp_goods_receipt ADD COLUMN IF NOT EXISTS supplier_code varchar(20);

CREATE INDEX IF NOT EXISTS ix_erp_goods_receipt_line_material_code ON erp_goods_receipt_line (material_code);
CREATE INDEX IF NOT EXISTS ix_erp_goods_receipt_line_uom_code ON erp_goods_receipt_line (uom_code);
CREATE INDEX IF NOT EXISTS ix_erp_goods_issue_line_material_code ON erp_goods_issue_line (material_code);
CREATE INDEX IF NOT EXISTS ix_erp_goods_issue_line_uom_code ON erp_goods_issue_line (uom_code);
CREATE INDEX IF NOT EXISTS ix_erp_goods_receipt_supplier_code ON erp_goods_receipt (supplier_code) WHERE supplier_code IS NOT NULL;
