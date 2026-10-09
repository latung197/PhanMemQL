-- Inventory: material types (loại vật tư). Safe to rerun. Run after 24-table-ref.sql.
-- Materials will point to a type with a column material_type_code once they have a backend.
CREATE TABLE IF NOT EXISTS erp_material_type (
    code varchar(20) PRIMARY KEY,
    name varchar(100) NOT NULL,
    group_name varchar(100),
    note varchar(300),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_material_type_name ON erp_material_type (lower(name));

-- The sample types the screen showed from the browser; only when the table is still empty.
INSERT INTO erp_material_type (code, name, group_name, note, sort_order)
SELECT v.code, v.name, v.group_name, v.note, v.sort_order
FROM (VALUES
    ('NVL',  'Nguyên vật liệu chính',          'Vật tư sản xuất',      'Thép, Nhôm, Linh kiện vi mạch bán thành phẩm', 1),
    ('LKC',  'Linh kiện điện tử',               'Phụ kiện & Linh kiện', 'Màn hình, Chip, RAM, Ổ cứng', 2),
    ('BTP',  'Bán thành phẩm',                  'Vật tư sản xuất',      'Cụm bo mạch đã lắp ráp', 3),
    ('TP',   'Thành phẩm hoàn chỉnh',           'Sản phẩm thương mại',  'Laptop, Màn hình, Bàn phím hoàn chỉnh', 4),
    ('CCDC', 'Công cụ dụng cụ & Vật tư phụ',    'Vật tư phụ',           'Thùng carton, Nhãn mác, Dụng cụ đóng gói', 5)
) AS v(code, name, group_name, note, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM erp_material_type);
