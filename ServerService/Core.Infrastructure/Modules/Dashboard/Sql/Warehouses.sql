-- Stock of the unit per warehouse (base currency): items with a quantity and their value.
SELECT b.warehouse_code AS code, coalesce(w.name, b.warehouse_code) AS name,
       count(*) FILTER (WHERE b.quantity <> 0)::int AS item_count, coalesce(sum(b.value), 0) AS value
FROM erp_stock_balance b
LEFT JOIN erp_warehouse w ON w.code = b.warehouse_code
WHERE b.unit_code = @unit
GROUP BY b.warehouse_code, w.name
ORDER BY coalesce(sum(b.value), 0) DESC, b.warehouse_code;
