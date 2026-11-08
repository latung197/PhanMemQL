-- Stock items of the unit at or under their minimum stock (quantity summed over the warehouses of the unit, base unit of the material).
-- Rows come worst first (lowest share of the minimum); @top limits them, total_count is the number before the limit.
WITH item AS (
    SELECT m.code, m.name, m.uom_code, m.min_stock, coalesce(sum(b.quantity), 0) AS quantity
    FROM erp_material m
    LEFT JOIN erp_stock_balance b ON b.material_code = m.code AND b.unit_code = @unit
    WHERE m.is_active AND m.is_stock_item AND m.min_stock IS NOT NULL AND m.min_stock > 0
    GROUP BY m.code, m.name, m.uom_code, m.min_stock
    HAVING coalesce(sum(b.quantity), 0) <= m.min_stock
)
SELECT code AS material_code, name AS material_name, uom_code, quantity, min_stock, (count(*) OVER ())::int AS total_count
FROM item
ORDER BY quantity / min_stock, code
LIMIT @top;
