-- Stock by warehouse, material and lot of one company unit (page: @pageSize, @offset); see BalancesWarehouse.sql.
SELECT b.unit_code, b.warehouse_code, w.name AS warehouse_name, b.material_code, m.name AS material_name, m.uom_code,
       b.lot_code, l.lot_no, l.exp_date, '' AS location_code, b.quantity, NULL::numeric AS value, count(*) OVER () AS total
FROM erp_stock_lot_balance b
JOIN erp_material m ON m.code = b.material_code
LEFT JOIN erp_warehouse w ON w.code = b.warehouse_code
LEFT JOIN erp_lot l ON l.code = b.lot_code
WHERE b.unit_code = @unit
  AND (@warehouse::varchar IS NULL OR b.warehouse_code = @warehouse)
  AND (@material::varchar IS NULL OR b.material_code = @material)
  AND (@lot::varchar IS NULL OR b.lot_code = @lot)
  AND (@includeZero OR b.quantity <> 0)
  AND (@search::varchar IS NULL OR sys_search_match(b.material_code, @search) OR sys_search_match(m.name, @search)
       OR sys_search_match(l.lot_no, @search))
ORDER BY b.warehouse_code, b.material_code, l.exp_date NULLS LAST, b.lot_code
LIMIT @pageSize OFFSET @offset;
