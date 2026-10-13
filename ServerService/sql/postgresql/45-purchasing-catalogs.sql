-- Mua hàng: danh mục dự án, điều khoản thanh toán, nhóm nhà cung cấp; cột dự án trên các chứng từ. Chạy lại được; chạy sau 44.
-- Dự án là chiều theo dõi: chứng từ mua hàng và kho ghi project_code để cộng chi phí theo dự án (báo cáo chi phí / lãi lỗ dự án).
-- Không khóa ngoại theo quy ước dự án: cột *_code có chỉ mục, dịch vụ kiểm mã khi lưu và chặn xóa danh mục đang được dùng.

CREATE TABLE IF NOT EXISTS erp_project (
    code varchar(20) PRIMARY KEY,
    name varchar(200) NOT NULL,
    department_code varchar(20),
    customer_name varchar(200),
    manager_name varchar(100),
    start_date date,
    end_date date,
    budget numeric(18,2) NOT NULL DEFAULT 0,
    status varchar(12) NOT NULL DEFAULT 'ACTIVE',
    note varchar(500),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    CONSTRAINT ck_erp_project_status CHECK (status IN ('PLANNING', 'ACTIVE', 'ONHOLD', 'DONE', 'CANCELLED')),
    CONSTRAINT ck_erp_project_budget CHECK (budget >= 0),
    CONSTRAINT ck_erp_project_dates CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_project_name ON erp_project (lower(name));
CREATE INDEX IF NOT EXISTS ix_erp_project_department_code ON erp_project (department_code) WHERE department_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS erp_payment_term (
    code varchar(20) PRIMARY KEY,
    name varchar(100) NOT NULL,
    days integer NOT NULL DEFAULT 0,
    note varchar(300),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    CONSTRAINT ck_erp_payment_term_days CHECK (days >= 0 AND days <= 1000)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_payment_term_name ON erp_payment_term (lower(name));

CREATE TABLE IF NOT EXISTS erp_supplier_group (
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_supplier_group_name ON erp_supplier_group (lower(name));

-- Nhà cung cấp thuộc một nhóm (không bắt buộc).
ALTER TABLE erp_supplier ADD COLUMN IF NOT EXISTS supplier_group_code varchar(20);
CREATE INDEX IF NOT EXISTS ix_erp_supplier_supplier_group_code ON erp_supplier (supplier_group_code) WHERE supplier_group_code IS NOT NULL;

-- Đơn mua hàng chọn điều khoản thanh toán từ danh mục; payment_terms giữ chữ lúc lưu (hoặc chữ tự do cũ).
ALTER TABLE erp_purchase_order ADD COLUMN IF NOT EXISTS payment_term_code varchar(20);
CREATE INDEX IF NOT EXISTS ix_erp_purchase_order_payment_term_code ON erp_purchase_order (payment_term_code) WHERE payment_term_code IS NOT NULL;

-- Cột dự án trên các chứng từ (không bắt buộc), mỗi cột có chỉ mục bắt đầu bằng chính nó (xóa dự án tra các cột này).
ALTER TABLE erp_purchase_request ADD COLUMN IF NOT EXISTS project_code varchar(20);
CREATE INDEX IF NOT EXISTS ix_erp_purchase_request_project_code ON erp_purchase_request (project_code) WHERE project_code IS NOT NULL;
ALTER TABLE erp_purchase_order ADD COLUMN IF NOT EXISTS project_code varchar(20);
CREATE INDEX IF NOT EXISTS ix_erp_purchase_order_project_code ON erp_purchase_order (project_code) WHERE project_code IS NOT NULL;
ALTER TABLE erp_goods_receipt ADD COLUMN IF NOT EXISTS project_code varchar(20);
CREATE INDEX IF NOT EXISTS ix_erp_goods_receipt_project_code ON erp_goods_receipt (project_code) WHERE project_code IS NOT NULL;
ALTER TABLE erp_goods_issue ADD COLUMN IF NOT EXISTS project_code varchar(20);
CREATE INDEX IF NOT EXISTS ix_erp_goods_issue_project_code ON erp_goods_issue (project_code) WHERE project_code IS NOT NULL;
ALTER TABLE erp_issue_request ADD COLUMN IF NOT EXISTS project_code varchar(20);
CREATE INDEX IF NOT EXISTS ix_erp_issue_request_project_code ON erp_issue_request (project_code) WHERE project_code IS NOT NULL;

-- Dữ liệu mẫu cho danh mục khi còn trống.
INSERT INTO erp_payment_term (code, name, days, note, sort_order)
SELECT v.code, v.name, v.days, v.note, v.sort_order
FROM (VALUES
    ('TT-NGAY', 'Thanh toán ngay', 0, 'Thanh toán khi đặt hàng', 1),
    ('COD', 'Thanh toán khi nhận hàng', 0, 'Trả tiền lúc nhận hàng', 2),
    ('NET15', 'Công nợ 15 ngày', 15, 'Thanh toán trong 15 ngày kể từ ngày nhận hóa đơn', 3),
    ('NET30', 'Công nợ 30 ngày', 30, 'Thanh toán trong 30 ngày kể từ ngày nhận hóa đơn', 4),
    ('NET45', 'Công nợ 45 ngày', 45, 'Thanh toán trong 45 ngày kể từ ngày nhận hóa đơn', 5),
    ('NET60', 'Công nợ 60 ngày', 60, 'Thanh toán trong 60 ngày kể từ ngày nhận hóa đơn', 6)
) AS v(code, name, days, note, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM erp_payment_term);

INSERT INTO erp_supplier_group (code, name, note, sort_order)
SELECT v.code, v.name, v.note, v.sort_order
FROM (VALUES
    ('NCC-VT', 'Nhà cung cấp vật tư', 'Nguyên vật liệu, linh kiện, vật tư tiêu hao', 1),
    ('NCC-TB', 'Nhà cung cấp thiết bị', 'Máy móc, thiết bị, hàng thương mại', 2),
    ('NCC-DV', 'Nhà cung cấp dịch vụ', 'Vận chuyển, bảo trì, thuê ngoài', 3)
) AS v(code, name, note, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM erp_supplier_group);
