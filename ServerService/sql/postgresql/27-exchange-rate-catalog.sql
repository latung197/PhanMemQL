-- Tỷ giá chuyển sang khung danh mục (CatalogService / CatalogScreen). Chạy lại được; chạy sau 07-currencies.sql và 26-*.sql.
-- Khóa của một tỷ giá là ngoại tệ + ngày, nên "mã" của dòng là chuỗi ghép "USD@2026-10-08" (cột code, duy nhất);
-- id vẫn là khóa chính. Thêm trạng thái, thứ tự và 4 cột dấu vết của ErpEntity; 2 cột cũ updated_at_utc / updated_by_user_id
-- được chuyển sang updated_at / updated_by rồi bỏ.
ALTER TABLE sys_exchange_rate ADD COLUMN IF NOT EXISTS code varchar(24);
UPDATE sys_exchange_rate SET code = currency_code || '@' || to_char(rate_date, 'YYYY-MM-DD') WHERE code IS NULL;
ALTER TABLE sys_exchange_rate ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_sys_exchange_rate_code ON sys_exchange_rate (code);

ALTER TABLE sys_exchange_rate ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE sys_exchange_rate ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE sys_exchange_rate ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE sys_exchange_rate ADD COLUMN IF NOT EXISTS created_by integer;
ALTER TABLE sys_exchange_rate ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE sys_exchange_rate ADD COLUMN IF NOT EXISTS updated_by integer;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sys_exchange_rate' AND column_name = 'updated_at_utc') THEN
        UPDATE sys_exchange_rate SET updated_at = updated_at_utc, updated_by = NULLIF(updated_by_user_id, 0), created_at = updated_at_utc;
        ALTER TABLE sys_exchange_rate DROP COLUMN updated_at_utc;
        ALTER TABLE sys_exchange_rate DROP COLUMN updated_by_user_id;
    END IF;
END $$;

-- Thứ tự mặc định của dòng cũ: ngày rồi ngoại tệ (dòng mới lấy số lớn nhất + 1).
UPDATE sys_exchange_rate r SET sort_order = n.rn
FROM (SELECT id, row_number() OVER (ORDER BY rate_date, currency_code) AS rn FROM sys_exchange_rate) n
WHERE r.id = n.id AND r.sort_order = 0;
