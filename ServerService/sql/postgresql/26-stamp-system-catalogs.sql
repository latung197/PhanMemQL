-- Người tạo / người sửa cho các danh mục hệ thống chuyển sang khung danh mục (CatalogService đọc 4 cột dấu vết của ErpEntity).
-- Dòng đã có: created_at = lúc chạy script, người tạo / người sửa để trống (hiện "—"). Chạy lại được.
ALTER TABLE sys_department   ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE sys_department   ADD COLUMN IF NOT EXISTS created_by integer;
ALTER TABLE sys_department   ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE sys_department   ADD COLUMN IF NOT EXISTS updated_by integer;

ALTER TABLE sys_currency     ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE sys_currency     ADD COLUMN IF NOT EXISTS created_by integer;
ALTER TABLE sys_currency     ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE sys_currency     ADD COLUMN IF NOT EXISTS updated_by integer;

ALTER TABLE sys_language     ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE sys_language     ADD COLUMN IF NOT EXISTS created_by integer;
ALTER TABLE sys_language     ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE sys_language     ADD COLUMN IF NOT EXISTS updated_by integer;

ALTER TABLE sys_company_unit ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE sys_company_unit ADD COLUMN IF NOT EXISTS created_by integer;
ALTER TABLE sys_company_unit ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE sys_company_unit ADD COLUMN IF NOT EXISTS updated_by integer;
