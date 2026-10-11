-- Kho: sổ kho dùng chung + ba bảng tồn. Chạy lại được; chạy sau 20-inventory-goods-receipts.sql, 31 / 32 / 33.
--
-- erp_stock_movement là sổ (nhật ký) chỉ ghi thêm: mỗi dòng phiếu ghi một dòng, số lượng có dấu (+ nhập, - xuất) theo
-- đơn vị tính gốc của vật tư. Bỏ ghi sổ không xóa dòng cũ mà ghi dòng đảo (reversal_of_id); ghi sổ lại tăng posting_seq.
-- Ba bảng tồn là số dư hiện tại, do dịch vụ ghi sổ cập nhật cùng giao dịch với sổ, luôn bằng tổng số lượng của sổ
-- (có thể dựng lại từ sổ, xem Inventory/Stock/Sql/RebuildBalances.sql):
--   erp_stock_balance          tồn theo (đơn vị, kho, vật tư): số lượng + giá trị
--   erp_stock_lot_balance      tồn theo (đơn vị, kho, vật tư, lô): số lượng; chỉ vật tư theo dõi lô
--   erp_stock_location_balance tồn theo (đơn vị, kho, vật tư, lô, vị trí): số lượng; chỉ vật tư theo dõi vị trí
-- Lô / vị trí không có thì ghi chuỗi rỗng trong bảng tồn (khóa chính không được null), null trong sổ.

-- ---- Sổ kho: đổi tên cột cũ, thêm cột mới, đổi khóa duy nhất ------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'erp_stock_movement' AND column_name = 'product_code') THEN
        PERFORM sys_rename_column('erp_stock_movement', 'product_code', 'material_code');
    END IF;
END $$;

ALTER TABLE erp_stock_movement ADD COLUMN IF NOT EXISTS lot_code varchar(81);
ALTER TABLE erp_stock_movement ADD COLUMN IF NOT EXISTS location_code varchar(30);
-- Đơn vị tính gốc của vật tư (số lượng của sổ tính theo đơn vị này) và đơn vị + số lượng ghi trên dòng phiếu.
ALTER TABLE erp_stock_movement ADD COLUMN IF NOT EXISTS uom_code varchar(20) NOT NULL DEFAULT '';
ALTER TABLE erp_stock_movement ADD COLUMN IF NOT EXISTS line_uom_code varchar(20);
ALTER TABLE erp_stock_movement ADD COLUMN IF NOT EXISTS line_quantity numeric(18,4);
ALTER TABLE erp_stock_movement ADD COLUMN IF NOT EXISTS posting_seq integer NOT NULL DEFAULT 1;
ALTER TABLE erp_stock_movement ADD COLUMN IF NOT EXISTS reversal_of_id bigint;
ALTER TABLE erp_stock_movement ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE erp_stock_movement ADD COLUMN IF NOT EXISTS created_by integer;
ALTER TABLE erp_stock_movement ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE erp_stock_movement ADD COLUMN IF NOT EXISTS updated_by integer;

DO $$
BEGIN
    -- Giờ ghi sổ cũ (posted_at) thành created_at.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'erp_stock_movement' AND column_name = 'posted_at') THEN
        UPDATE erp_stock_movement SET created_at = posted_at;
        ALTER TABLE erp_stock_movement DROP COLUMN posted_at;
    END IF;
END $$;

-- Khóa duy nhất cũ (một dòng sổ cho mỗi dòng phiếu) không còn đúng khi có dòng đảo và ghi sổ lại.
ALTER TABLE erp_stock_movement DROP CONSTRAINT IF EXISTS erp_stock_movement_source_function_source_line_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_stock_movement_posting
    ON erp_stock_movement (source_function, source_line_id, posting_seq) WHERE reversal_of_id IS NULL;
-- Một dòng sổ chỉ bị đảo một lần.
CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_stock_movement_reversal
    ON erp_stock_movement (reversal_of_id) WHERE reversal_of_id IS NOT NULL;

DROP INDEX IF EXISTS ix_erp_stock_movement_balance;
-- Mỗi cột *_code trỏ danh mục khác có index bắt đầu bằng chính cột đó.
CREATE INDEX IF NOT EXISTS ix_erp_stock_movement_unit_code ON erp_stock_movement (unit_code, warehouse_code, material_code, document_date);
CREATE INDEX IF NOT EXISTS ix_erp_stock_movement_warehouse_code ON erp_stock_movement (warehouse_code, material_code);
CREATE INDEX IF NOT EXISTS ix_erp_stock_movement_material_code ON erp_stock_movement (material_code, document_date);
CREATE INDEX IF NOT EXISTS ix_erp_stock_movement_lot_code ON erp_stock_movement (lot_code) WHERE lot_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_erp_stock_movement_location_code ON erp_stock_movement (location_code) WHERE location_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_erp_stock_movement_uom_code ON erp_stock_movement (uom_code);

-- ---- Ba bảng tồn -----------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS erp_stock_balance (
    unit_code varchar(20) NOT NULL,
    warehouse_code varchar(20) NOT NULL,
    material_code varchar(50) NOT NULL,
    quantity numeric(18,4) NOT NULL DEFAULT 0,
    value numeric(18,2) NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    PRIMARY KEY (unit_code, warehouse_code, material_code)
);
CREATE INDEX IF NOT EXISTS ix_erp_stock_balance_warehouse_code ON erp_stock_balance (warehouse_code, material_code);
CREATE INDEX IF NOT EXISTS ix_erp_stock_balance_material_code ON erp_stock_balance (material_code);

CREATE TABLE IF NOT EXISTS erp_stock_lot_balance (
    unit_code varchar(20) NOT NULL,
    warehouse_code varchar(20) NOT NULL,
    material_code varchar(50) NOT NULL,
    lot_code varchar(81) NOT NULL,
    quantity numeric(18,4) NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    PRIMARY KEY (unit_code, warehouse_code, material_code, lot_code)
);
CREATE INDEX IF NOT EXISTS ix_erp_stock_lot_balance_warehouse_code ON erp_stock_lot_balance (warehouse_code, material_code);
CREATE INDEX IF NOT EXISTS ix_erp_stock_lot_balance_material_code ON erp_stock_lot_balance (material_code);
CREATE INDEX IF NOT EXISTS ix_erp_stock_lot_balance_lot_code ON erp_stock_lot_balance (lot_code);

CREATE TABLE IF NOT EXISTS erp_stock_location_balance (
    unit_code varchar(20) NOT NULL,
    warehouse_code varchar(20) NOT NULL,
    material_code varchar(50) NOT NULL,
    lot_code varchar(81) NOT NULL DEFAULT '',
    location_code varchar(30) NOT NULL,
    quantity numeric(18,4) NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    PRIMARY KEY (unit_code, warehouse_code, material_code, lot_code, location_code)
);
CREATE INDEX IF NOT EXISTS ix_erp_stock_location_balance_warehouse_code ON erp_stock_location_balance (warehouse_code, material_code);
CREATE INDEX IF NOT EXISTS ix_erp_stock_location_balance_material_code ON erp_stock_location_balance (material_code);
CREATE INDEX IF NOT EXISTS ix_erp_stock_location_balance_lot_code ON erp_stock_location_balance (lot_code);
CREATE INDEX IF NOT EXISTS ix_erp_stock_location_balance_location_code ON erp_stock_location_balance (location_code);

-- Sổ cũ (trước khi có bảng tồn) còn dòng mà bảng tồn còn trống: dựng tồn theo kho từ sổ.
INSERT INTO erp_stock_balance (unit_code, warehouse_code, material_code, quantity, value)
SELECT m.unit_code, m.warehouse_code, m.material_code, sum(m.quantity), sum(m.value)
FROM erp_stock_movement m
WHERE NOT EXISTS (SELECT 1 FROM erp_stock_balance)
GROUP BY m.unit_code, m.warehouse_code, m.material_code;

-- Đơn vị tính ghi trên dòng phiếu cũng là cột trỏ danh mục đơn vị tính nên có index riêng.
CREATE INDEX IF NOT EXISTS ix_erp_stock_movement_line_uom_code ON erp_stock_movement (line_uom_code) WHERE line_uom_code IS NOT NULL;
