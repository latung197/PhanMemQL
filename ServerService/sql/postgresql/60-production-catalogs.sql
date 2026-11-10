-- Sản xuất: danh mục tổ sản xuất (erp_production_team) và danh mục công đoạn sản xuất (erp_production_operation).
-- Một công đoạn do một tổ thực hiện (production_team_code, có thể trống). Không khóa ngoại: dịch vụ kiểm tra mã khi lưu,
-- khung danh mục chặn xóa tổ còn công đoạn dùng. Chạy lại được.
CREATE TABLE IF NOT EXISTS erp_production_team (
    code varchar(20) PRIMARY KEY,
    name varchar(100) NOT NULL,
    note varchar(300),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_production_team_name ON erp_production_team (lower(name));

CREATE TABLE IF NOT EXISTS erp_production_operation (
    code varchar(20) PRIMARY KEY,
    name varchar(200) NOT NULL,
    name_en varchar(200),
    production_team_code varchar(20),
    require_machine boolean NOT NULL DEFAULT false,
    is_heavy boolean NOT NULL DEFAULT false,
    note varchar(300),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_production_operation_name ON erp_production_operation (lower(name));
CREATE INDEX IF NOT EXISTS ix_erp_production_operation_production_team_code ON erp_production_operation (production_team_code) WHERE production_team_code IS NOT NULL;
