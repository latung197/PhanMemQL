-- Kho: định mức tồn kho theo kho (erp_stock_norm). Chạy lại được; chạy sau 55-inventory-reports.sql, 31-inventory-materials.sql và kho.
-- Khóa là vật tư + kho nên khóa chính là mã ghép "VT001@KHO1" (cột code), giống mã lô. Định mức dùng chung mọi đơn vị cơ sở (kho là
-- danh mục chung). Số lượng tính theo đơn vị tính gốc của vật tư. Báo cáo tồn kho lấy tối thiểu / tối đa của dòng này, thiếu thì lấy
-- tối thiểu / tối đa khai trên vật tư (erp_material.min_stock / max_stock).
CREATE TABLE IF NOT EXISTS erp_stock_norm (
    code varchar(71) PRIMARY KEY,
    material_code varchar(50) NOT NULL,
    warehouse_code varchar(20) NOT NULL,
    min_quantity numeric(18, 4),
    max_quantity numeric(18, 4),
    safety_quantity numeric(18, 4),
    reorder_point numeric(18, 4),
    note varchar(300),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    CONSTRAINT ck_erp_stock_norm_qty CHECK (coalesce(min_quantity, 0) >= 0 AND coalesce(max_quantity, 0) >= 0
        AND coalesce(safety_quantity, 0) >= 0 AND coalesce(reorder_point, 0) >= 0),
    CONSTRAINT ck_erp_stock_norm_range CHECK (min_quantity IS NULL OR max_quantity IS NULL OR max_quantity >= min_quantity)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_stock_norm_pair ON erp_stock_norm (material_code, warehouse_code);
CREATE INDEX IF NOT EXISTS ix_erp_stock_norm_material_code ON erp_stock_norm (material_code, warehouse_code);
CREATE INDEX IF NOT EXISTS ix_erp_stock_norm_warehouse_code ON erp_stock_norm (warehouse_code);

-- Báo cáo tồn kho: tối thiểu / tối đa theo định mức của kho, thiếu thì theo vật tư (0 hoặc trống = chưa khai).
DROP FUNCTION IF EXISTS rpt_stock_balance(text, date, text, text, text, boolean);
CREATE FUNCTION rpt_stock_balance(p_unit text, p_as_of date, p_warehouse text, p_group text, p_search text, p_include_zero boolean)
RETURNS TABLE (warehouse_code text, warehouse_name text, material_code text, material_name text, uom_code text, group_code text,
               quantity numeric, value numeric, min_stock numeric, max_stock numeric)
LANGUAGE sql STABLE AS $$
    SELECT s.warehouse_code::text, w.name::text, s.material_code::text, m.name::text, m.uom_code::text, m.material_group_code::text,
           sum(s.quantity), sum(s.value),
           CASE WHEN coalesce(n.min_quantity, 0) > 0 THEN n.min_quantity ELSE m.min_stock END,
           CASE WHEN coalesce(n.max_quantity, 0) > 0 THEN n.max_quantity ELSE m.max_stock END
    FROM erp_stock_movement s
    JOIN erp_material m ON m.code = s.material_code
    LEFT JOIN erp_warehouse w ON w.code = s.warehouse_code
    LEFT JOIN erp_stock_norm n ON n.material_code = s.material_code AND n.warehouse_code = s.warehouse_code AND n.is_active
    WHERE s.unit_code = p_unit AND s.document_date <= p_as_of
      AND (p_warehouse IS NULL OR s.warehouse_code = p_warehouse)
      AND (p_group IS NULL OR m.material_group_code = p_group)
      AND (p_search IS NULL OR sys_search_match(s.material_code, p_search) OR sys_search_match(m.name, p_search))
    GROUP BY s.warehouse_code, w.name, s.material_code, m.name, m.uom_code, m.material_group_code, m.min_stock, m.max_stock,
             n.min_quantity, n.max_quantity
    HAVING p_include_zero OR sum(s.quantity) <> 0
    ORDER BY s.warehouse_code, s.material_code
$$;
