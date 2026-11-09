-- Kho: các hàm báo cáo đọc từ sổ kho (erp_stock_movement). Backend chỉ gọi `SELECT * FROM rpt_...(...)` (Core.Infrastructure/Modules/Inventory/Reports),
-- các công cụ khác (Excel, Power BI, psql) gọi lại được đúng các hàm này. Chạy lại được: mỗi hàm DROP rồi CREATE, nên đổi cột trả về cũng chạy lại được.
-- Quy ước: tham số p_*, cột trả về là snake_case, giá trị theo tiền hạch toán, số lượng theo đơn vị tính gốc của vật tư; p_unit là đơn vị cơ sở;
-- p_warehouse / p_group / p_search có thể null (không lọc); p_search là mẫu ILIKE đã có % hai đầu (sys_search_match, không phân biệt dấu).
-- Sổ kho là sổ chỉ ghi thêm: phiếu bỏ ghi sổ để lại dòng đảo (reversal_of_id) nên tổng thẳng các dòng là đúng; bảng kê nhập / xuất chỉ lấy dòng "còn hiệu lực"
-- (không phải dòng đảo và chưa bị đảo), nhập xuất tồn tính dòng đảo vào đúng chiều của dòng gốc.

-- Hàm rpt_stock_balance (tồn kho tại một ngày, có định mức theo kho) nằm trong 56-stock-norms.sql.

-- ------------------------------------------------------------------------------------------------------------ nhập xuất tồn của một kỳ
DROP FUNCTION IF EXISTS rpt_stock_nxt(text, date, date, text, text, text, boolean);
CREATE FUNCTION rpt_stock_nxt(p_unit text, p_from date, p_to date, p_warehouse text, p_group text, p_search text, p_include_zero boolean)
RETURNS TABLE (warehouse_code text, warehouse_name text, material_code text, material_name text, uom_code text,
               opening_quantity numeric, in_quantity numeric, out_quantity numeric, closing_quantity numeric,
               opening_value numeric, in_value numeric, out_value numeric, closing_value numeric)
LANGUAGE sql STABLE AS $$
    WITH mv AS (
        SELECT s.warehouse_code, s.material_code, s.document_date, s.quantity, s.value,
               CASE WHEN coalesce(o.quantity, s.quantity) > 0 THEN 'IN' ELSE 'OUT' END AS dir
        FROM erp_stock_movement s
        LEFT JOIN erp_stock_movement o ON o.id = s.reversal_of_id
        JOIN erp_material m ON m.code = s.material_code
        WHERE s.unit_code = p_unit AND s.document_date <= p_to
          AND (p_warehouse IS NULL OR s.warehouse_code = p_warehouse)
          AND (p_group IS NULL OR m.material_group_code = p_group)
          AND (p_search IS NULL OR sys_search_match(s.material_code, p_search) OR sys_search_match(m.name, p_search))
    ), agg AS (
        SELECT mv.warehouse_code, mv.material_code,
               coalesce(sum(mv.quantity) FILTER (WHERE mv.document_date < p_from), 0) AS oq,
               coalesce(sum(mv.value) FILTER (WHERE mv.document_date < p_from), 0) AS ov,
               coalesce(sum(mv.quantity) FILTER (WHERE mv.document_date >= p_from AND mv.dir = 'IN'), 0) AS iq,
               coalesce(sum(mv.value) FILTER (WHERE mv.document_date >= p_from AND mv.dir = 'IN'), 0) AS iv,
               coalesce(-sum(mv.quantity) FILTER (WHERE mv.document_date >= p_from AND mv.dir = 'OUT'), 0) AS xq,
               coalesce(-sum(mv.value) FILTER (WHERE mv.document_date >= p_from AND mv.dir = 'OUT'), 0) AS xv
        FROM mv
        GROUP BY mv.warehouse_code, mv.material_code
    )
    SELECT a.warehouse_code::text, w.name::text, a.material_code::text, m.name::text, m.uom_code::text,
           a.oq, a.iq, a.xq, a.oq + a.iq - a.xq, a.ov, a.iv, a.xv, a.ov + a.iv - a.xv
    FROM agg a
    JOIN erp_material m ON m.code = a.material_code
    LEFT JOIN erp_warehouse w ON w.code = a.warehouse_code
    WHERE p_include_zero OR a.oq <> 0 OR a.iq <> 0 OR a.xq <> 0 OR a.oq + a.iq - a.xq <> 0
    ORDER BY a.warehouse_code, a.material_code
$$;

-- ------------------------------------------------------------------------------------------------------------ bảng kê hàng nhập (p_direction = 1) / xuất (-1)
DROP FUNCTION IF EXISTS rpt_stock_movements(text, integer, date, date, text, text, text, integer);
CREATE FUNCTION rpt_stock_movements(p_unit text, p_direction integer, p_from date, p_to date, p_warehouse text, p_group text, p_search text, p_limit integer)
RETURNS TABLE (document_date date, source_function text, voucher_code text, voucher_type text, partner text,
               warehouse_code text, warehouse_name text, material_code text, material_name text, uom_code text, lot_code text,
               quantity numeric, value numeric, unit_price numeric)
LANGUAGE sql STABLE AS $$
    SELECT d.document_date, d.source_function, d.voucher_code, d.voucher_type, d.partner, d.warehouse_code, d.warehouse_name, d.material_code,
           d.material_name, d.uom_code, d.lot_code, d.quantity, d.value, d.unit_price
    FROM (
        SELECT s.document_date, s.source_function::text,
               coalesce(r.code, i.code, ti.code, tr.code, c.code)::text AS voucher_code,
               coalesce(r.voucher_type, i.voucher_type)::text AS voucher_type,
               coalesce(r.supplier_name, i.customer_name)::text AS partner,
               s.warehouse_code::text AS warehouse_code, w.name::text AS warehouse_name, s.material_code::text AS material_code, m.name::text AS material_name,
               m.uom_code::text AS uom_code, nullif(s.lot_code, '')::text AS lot_code,
               abs(s.quantity) AS quantity, abs(s.value) AS value,
               CASE WHEN s.quantity = 0 THEN 0 ELSE round(abs(s.value) / abs(s.quantity), 4) END AS unit_price,
               s.id
        FROM erp_stock_movement s
        JOIN erp_material m ON m.code = s.material_code
        LEFT JOIN erp_warehouse w ON w.code = s.warehouse_code
        LEFT JOIN erp_goods_receipt r ON s.source_function = 'inv_receipt' AND r.id = s.source_id
        LEFT JOIN erp_goods_issue i ON s.source_function = 'inv_issue' AND i.id = s.source_id
        LEFT JOIN erp_transfer_issue ti ON s.source_function = 'inv_transfer_issue' AND ti.id = s.source_id
        LEFT JOIN erp_transfer_receipt tr ON s.source_function = 'inv_transfer_receipt' AND tr.id = s.source_id
        LEFT JOIN erp_stock_count c ON s.source_function IN ('inv_audit_count', 'inv_audit_count_out') AND c.id = s.source_id
        WHERE s.unit_code = p_unit AND s.document_date BETWEEN p_from AND p_to
          AND s.reversal_of_id IS NULL AND sign(s.quantity) = p_direction
          AND NOT EXISTS (SELECT 1 FROM erp_stock_movement x WHERE x.reversal_of_id = s.id)
          AND (p_warehouse IS NULL OR s.warehouse_code = p_warehouse)
          AND (p_group IS NULL OR m.material_group_code = p_group)
          AND (p_search IS NULL OR sys_search_match(s.material_code, p_search) OR sys_search_match(m.name, p_search)
               OR sys_search_match(coalesce(r.code, i.code, ti.code, tr.code, c.code, ''), p_search)
               OR sys_search_match(coalesce(r.supplier_name, i.customer_name, ''), p_search))
    ) d
    ORDER BY d.document_date, d.voucher_code, d.id
    LIMIT p_limit
$$;

-- Cùng bảng kê, gộp theo kho + vật tư.
DROP FUNCTION IF EXISTS rpt_stock_movement_summary(text, integer, date, date, text, text, text);
CREATE FUNCTION rpt_stock_movement_summary(p_unit text, p_direction integer, p_from date, p_to date, p_warehouse text, p_group text, p_search text)
RETURNS TABLE (warehouse_code text, warehouse_name text, material_code text, material_name text, uom_code text,
               voucher_count integer, quantity numeric, value numeric)
LANGUAGE sql STABLE AS $$
    SELECT d.warehouse_code, d.warehouse_name, d.material_code, d.material_name, d.uom_code,
           count(DISTINCT d.voucher_code)::integer, sum(d.quantity), sum(d.value)
    FROM rpt_stock_movements(p_unit, p_direction, p_from, p_to, p_warehouse, p_group, p_search, 2147483647) d
    GROUP BY d.warehouse_code, d.warehouse_name, d.material_code, d.material_name, d.uom_code
    ORDER BY d.warehouse_code, d.material_code
$$;

-- ------------------------------------------------------------------------------------------------------------ tuổi hàng tồn tại một ngày
-- Tồn của mỗi kho + vật tư được coi là các lần nhập mới nhất (hàng cũ xuất trước). Giá trị mỗi nhóm = giá trị tồn của sổ kho (giá bình quân của kho, đúng
-- cách sổ kho tính giá xuất) chia theo số lượng của nhóm, nên các nhóm luôn cộng lại bằng giá trị tồn. Phần tồn không đối chiếu được với lần nhập nào
-- (ví dụ dòng nhập đã bị đảo) được cộng vào nhóm trên 180 ngày.
DROP FUNCTION IF EXISTS rpt_stock_aging(text, date, text, text, text);
CREATE FUNCTION rpt_stock_aging(p_unit text, p_as_of date, p_warehouse text, p_group text, p_search text)
RETURNS TABLE (warehouse_code text, warehouse_name text, material_code text, material_name text, uom_code text, quantity numeric,
               qty_0_30 numeric, qty_31_60 numeric, qty_61_90 numeric, qty_91_180 numeric, qty_over_180 numeric,
               value numeric, value_0_30 numeric, value_31_60 numeric, value_61_90 numeric, value_91_180 numeric, value_over_180 numeric)
LANGUAGE sql STABLE AS $$
    WITH bal AS (
        SELECT s.warehouse_code, s.material_code, sum(s.quantity) AS q, sum(s.value) AS v
        FROM erp_stock_movement s
        JOIN erp_material m ON m.code = s.material_code
        WHERE s.unit_code = p_unit AND s.document_date <= p_as_of
          AND (p_warehouse IS NULL OR s.warehouse_code = p_warehouse)
          AND (p_group IS NULL OR m.material_group_code = p_group)
          AND (p_search IS NULL OR sys_search_match(s.material_code, p_search) OR sys_search_match(m.name, p_search))
        GROUP BY s.warehouse_code, s.material_code
        HAVING sum(s.quantity) > 0
    ), ins AS (
        SELECT s.id, s.warehouse_code, s.material_code, s.document_date, s.quantity AS qty, s.value AS val
        FROM erp_stock_movement s
        JOIN bal b ON b.warehouse_code = s.warehouse_code AND b.material_code = s.material_code
        WHERE s.unit_code = p_unit AND s.document_date <= p_as_of AND s.reversal_of_id IS NULL AND s.quantity > 0
          AND NOT EXISTS (SELECT 1 FROM erp_stock_movement x WHERE x.reversal_of_id = s.id)
    ), ranked AS (
        SELECT i.*, sum(i.qty) OVER (PARTITION BY i.warehouse_code, i.material_code ORDER BY i.document_date DESC, i.id DESC) AS cum
        FROM ins i
    ), alloc AS (
        SELECT r.warehouse_code, r.material_code, p_as_of - r.document_date AS age,
               least(r.qty, greatest(0, b.q - (r.cum - r.qty))) AS aq,
               b.v * least(r.qty, greatest(0, b.q - (r.cum - r.qty))) / b.q AS av
        FROM ranked r
        JOIN bal b ON b.warehouse_code = r.warehouse_code AND b.material_code = r.material_code
    ), bucket AS (
        SELECT b.warehouse_code, b.material_code, b.q, b.v,
               coalesce(sum(a.aq) FILTER (WHERE a.age <= 30), 0) AS q1,
               coalesce(sum(a.aq) FILTER (WHERE a.age BETWEEN 31 AND 60), 0) AS q2,
               coalesce(sum(a.aq) FILTER (WHERE a.age BETWEEN 61 AND 90), 0) AS q3,
               coalesce(sum(a.aq) FILTER (WHERE a.age BETWEEN 91 AND 180), 0) AS q4,
               coalesce(sum(a.av) FILTER (WHERE a.age <= 30), 0) AS v1,
               coalesce(sum(a.av) FILTER (WHERE a.age BETWEEN 31 AND 60), 0) AS v2,
               coalesce(sum(a.av) FILTER (WHERE a.age BETWEEN 61 AND 90), 0) AS v3,
               coalesce(sum(a.av) FILTER (WHERE a.age BETWEEN 91 AND 180), 0) AS v4
        FROM bal b
        LEFT JOIN alloc a ON a.warehouse_code = b.warehouse_code AND a.material_code = b.material_code
        GROUP BY b.warehouse_code, b.material_code, b.q, b.v
    )
    SELECT k.warehouse_code::text, w.name::text, k.material_code::text, m.name::text, m.uom_code::text, k.q,
           k.q1, k.q2, k.q3, k.q4, k.q - k.q1 - k.q2 - k.q3 - k.q4,
           k.v, k.v1, k.v2, k.v3, k.v4, k.v - k.v1 - k.v2 - k.v3 - k.v4
    FROM bucket k
    JOIN erp_material m ON m.code = k.material_code
    LEFT JOIN erp_warehouse w ON w.code = k.warehouse_code
    ORDER BY k.warehouse_code, k.material_code
$$;

-- ------------------------------------------------------------------------------------------------------------ giá trung bình tháng
-- Giá bình quân gia quyền của một tháng: (giá trị tồn đầu + giá trị nhập) / (số lượng tồn đầu + số lượng nhập), tính từ nhập xuất tồn của tháng.
-- closing_cost là giá vốn bình quân hiện hành của sổ kho cuối tháng (giá trị cuối / số lượng cuối), để so với giá bình quân tháng.
-- Chỉ để xem: không sửa giá của phiếu đã ghi sổ (phiếu xuất đã được sổ kho tính giá bình quân di động lúc ghi sổ).
DROP FUNCTION IF EXISTS rpt_stock_monthly_cost(text, date, date, text, text, text, boolean);
CREATE FUNCTION rpt_stock_monthly_cost(p_unit text, p_from date, p_to date, p_warehouse text, p_group text, p_search text, p_include_zero boolean)
RETURNS TABLE (warehouse_code text, warehouse_name text, material_code text, material_name text, uom_code text,
               opening_quantity numeric, opening_value numeric, in_quantity numeric, in_value numeric,
               out_quantity numeric, out_value numeric, closing_quantity numeric, closing_value numeric,
               month_avg_cost numeric, closing_cost numeric)
LANGUAGE sql STABLE AS $$
    SELECT n.warehouse_code, n.warehouse_name, n.material_code, n.material_name, n.uom_code,
           n.opening_quantity, n.opening_value, n.in_quantity, n.in_value, n.out_quantity, n.out_value, n.closing_quantity, n.closing_value,
           CASE WHEN n.opening_quantity + n.in_quantity > 0 THEN (n.opening_value + n.in_value) / (n.opening_quantity + n.in_quantity) END,
           CASE WHEN n.closing_quantity > 0 THEN n.closing_value / n.closing_quantity END
    FROM rpt_stock_nxt(p_unit, p_from, p_to, p_warehouse, p_group, p_search, p_include_zero) n
$$;

-- ------------------------------------------------------------------------------------------------------------ tồn kho tức thời, số đã giữ chỗ, số khả dụng
-- Tồn hiện có lấy từ bảng số dư erp_stock_balance (luôn bằng tổng sổ kho). Số đã giữ chỗ là phần chưa xuất của các phiếu yêu cầu xuất kho và đơn bán hàng
-- đã duyệt trong kho đó, đổi ra đơn vị tính gốc của vật tư như sổ kho (quy đổi của vật tư thắng quy đổi chung, quy đổi viết ngược thì lấy nghịch đảo):
-- số lượng dòng trừ số đã xuất trên các phiếu xuất ĐÃ GHI SỔ nối vào dòng đó (phiếu xuất chưa ghi sổ chưa lấy hàng ra khỏi kho nên vẫn còn giữ chỗ).
-- Khả dụng = tồn - giữ chỗ theo yêu cầu - giữ chỗ theo đơn bán; có thể âm khi đã hứa nhiều hơn tồn.
DROP FUNCTION IF EXISTS rpt_stock_availability(text, text, text, text, boolean);
CREATE FUNCTION rpt_stock_availability(p_unit text, p_warehouse text, p_group text, p_search text, p_include_zero boolean)
RETURNS TABLE (warehouse_code text, warehouse_name text, material_code text, material_name text, uom_code text, group_code text,
               quantity numeric, reserved_request numeric, reserved_order numeric, available numeric)
LANGUAGE sql STABLE AS $$
    WITH demand AS (
        SELECT x.warehouse_code, x.material_code, x.kind, sum(x.remaining * f.factor) AS qty
        FROM (
            SELECT h.warehouse_code, l.material_code, 'REQ' AS kind,
                   l.quantity - coalesce((SELECT sum(g.quantity) FROM erp_goods_issue_line g JOIN erp_goods_issue gi ON gi.id = g.issue_id
                                          WHERE g.issue_request_line_id = l.id AND g.kind = 'ITEM' AND gi.status = 'Posted'), 0) AS remaining,
                   m.uom_code AS base_uom, l.uom_code AS line_uom
            FROM erp_issue_request h
            JOIN erp_issue_request_line l ON l.request_id = h.id
            JOIN erp_material m ON m.code = l.material_code
            WHERE h.unit_code = p_unit AND h.status = 'Approved'
            UNION ALL
            SELECT h.warehouse_code, l.material_code, 'SO',
                   l.quantity - coalesce((SELECT sum(g.quantity) FROM erp_goods_issue_line g JOIN erp_goods_issue gi ON gi.id = g.issue_id
                                          WHERE g.sales_order_line_id = l.id AND g.kind = 'ITEM' AND gi.status = 'Posted'), 0),
                   m.uom_code, l.uom_code
            FROM erp_sales_order h
            JOIN erp_sales_order_line l ON l.order_id = h.id
            JOIN erp_material m ON m.code = l.material_code
            WHERE h.unit_code = p_unit AND h.status = 'Approved'
        ) x
        CROSS JOIN LATERAL (
            SELECT CASE WHEN x.line_uom = x.base_uom THEN 1::numeric
                        ELSE coalesce((SELECT CASE WHEN c.from_uom_code = x.line_uom THEN c.factor ELSE 1 / c.factor END
                                       FROM erp_uom_conversion c
                                       WHERE c.is_active AND c.factor > 0 AND (coalesce(c.material_code, '') IN ('', x.material_code))
                                         AND ((c.from_uom_code = x.line_uom AND c.to_uom_code = x.base_uom)
                                           OR (c.from_uom_code = x.base_uom AND c.to_uom_code = x.line_uom))
                                       ORDER BY (c.material_code = x.material_code) DESC NULLS LAST LIMIT 1), 1) END AS factor
        ) f
        WHERE x.remaining > 0
        GROUP BY x.warehouse_code, x.material_code, x.kind
    ), stock AS (
        SELECT b.warehouse_code, b.material_code, b.quantity FROM erp_stock_balance b WHERE b.unit_code = p_unit
    ), keys AS (
        SELECT warehouse_code, material_code FROM stock UNION SELECT warehouse_code, material_code FROM demand
    )
    SELECT k.warehouse_code::text, w.name::text, k.material_code::text, m.name::text, m.uom_code::text, m.material_group_code::text,
           coalesce(s.quantity, 0),
           coalesce((SELECT qty FROM demand d WHERE d.warehouse_code = k.warehouse_code AND d.material_code = k.material_code AND d.kind = 'REQ'), 0),
           coalesce((SELECT qty FROM demand d WHERE d.warehouse_code = k.warehouse_code AND d.material_code = k.material_code AND d.kind = 'SO'), 0),
           coalesce(s.quantity, 0)
             - coalesce((SELECT qty FROM demand d WHERE d.warehouse_code = k.warehouse_code AND d.material_code = k.material_code AND d.kind = 'REQ'), 0)
             - coalesce((SELECT qty FROM demand d WHERE d.warehouse_code = k.warehouse_code AND d.material_code = k.material_code AND d.kind = 'SO'), 0)
    FROM keys k
    JOIN erp_material m ON m.code = k.material_code
    LEFT JOIN erp_warehouse w ON w.code = k.warehouse_code
    LEFT JOIN stock s ON s.warehouse_code = k.warehouse_code AND s.material_code = k.material_code
    WHERE (p_warehouse IS NULL OR k.warehouse_code = p_warehouse)
      AND (p_group IS NULL OR m.material_group_code = p_group)
      AND (p_include_zero OR coalesce(s.quantity, 0) <> 0
           OR EXISTS (SELECT 1 FROM demand d WHERE d.warehouse_code = k.warehouse_code AND d.material_code = k.material_code))
      AND (p_search IS NULL OR sys_search_match(k.material_code, p_search) OR sys_search_match(m.name, p_search))
    ORDER BY k.warehouse_code, k.material_code
$$;
