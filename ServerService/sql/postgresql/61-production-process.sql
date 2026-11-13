-- Sản xuất: danh mục quy trình sản xuất = danh sách công đoạn theo thứ tự (erp_production_process_line), hiệu lực từ ngày đến ngày,
-- áp dụng cho một số đơn vị cơ sở (erp_production_process_unit; không dòng nào = mọi đơn vị). Không khóa ngoại. Chạy lại được.
CREATE TABLE IF NOT EXISTS erp_production_process (
    code varchar(20) PRIMARY KEY,
    name varchar(200) NOT NULL,
    name_en varchar(200),
    effective_from date NOT NULL,
    effective_to date,
    note varchar(300),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    CONSTRAINT ck_erp_production_process_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_production_process_name ON erp_production_process (lower(name));

CREATE TABLE IF NOT EXISTS erp_production_process_unit (
    production_process_code varchar(20) NOT NULL,
    unit_code varchar(20) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    PRIMARY KEY (production_process_code, unit_code)
);
CREATE INDEX IF NOT EXISTS ix_erp_production_process_unit_unit_code ON erp_production_process_unit (unit_code);

CREATE TABLE IF NOT EXISTS erp_production_process_line (
    production_process_code varchar(20) NOT NULL,
    line_no integer NOT NULL,
    production_operation_code varchar(20) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    PRIMARY KEY (production_process_code, line_no)
);
CREATE INDEX IF NOT EXISTS ix_erp_production_process_line_production_operation_code ON erp_production_process_line (production_operation_code);
