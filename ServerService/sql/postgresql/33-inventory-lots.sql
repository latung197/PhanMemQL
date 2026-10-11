-- Kho: danh mục lô và hạn sử dụng (erp_lot). Chạy lại được; chạy sau 31-inventory-materials.sql, 22-inventory-suppliers.sql.
-- Khóa của một lô là vật tư + số lô, nên khóa chính là "mã" ghép "VT001@LOT-2610" (cột code), giống mã tỷ giá. Các bảng sổ kho
-- và tồn kho trỏ tới lô bằng chính mã này. Số lượng còn lại lấy từ sổ kho, không lưu ở đây. Tình trạng hết hạn tính từ ngày
-- hết hạn khi đọc.
CREATE TABLE IF NOT EXISTS erp_lot (
    code varchar(81) PRIMARY KEY,
    material_code varchar(50) NOT NULL,
    lot_no varchar(30) NOT NULL,
    mfg_date date,
    exp_date date,
    supplier_code varchar(20),
    quality_status varchar(10) NOT NULL DEFAULT 'PASSED',
    note varchar(300),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    CONSTRAINT ck_erp_lot_quality CHECK (quality_status IN ('PASSED', 'INSPECT', 'BLOCKED')),
    CONSTRAINT ck_erp_lot_dates CHECK (mfg_date IS NULL OR exp_date IS NULL OR exp_date >= mfg_date)
);

-- Bản đầu của script này dùng id làm khóa chính: chuyển sang khóa chính là mã.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'erp_lot' AND column_name = 'id') THEN
        ALTER TABLE erp_lot DROP CONSTRAINT IF EXISTS erp_lot_pkey;
        DROP INDEX IF EXISTS ux_erp_lot_code;
        ALTER TABLE erp_lot ADD PRIMARY KEY (code);
        ALTER TABLE erp_lot DROP COLUMN id;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_erp_lot_material_code ON erp_lot (material_code, lot_no);
CREATE INDEX IF NOT EXISTS ix_erp_lot_supplier_code ON erp_lot (supplier_code);
CREATE INDEX IF NOT EXISTS ix_erp_lot_exp_date ON erp_lot (exp_date);
