-- Stock by warehouse and material of one company unit (page: @pageSize, @offset). Filters are optional (null = all);
-- @search matches the material code or name ignoring accents. Zero balances are left out unless @includeZero.
SELECT b.unit_code, b.warehouse_code, w.name AS warehouse_name, b.material_code, m.name AS material_name, m.uom_code,
       '' AS lot_code, NULL::varchar AS lot_no, NULL::date AS exp_date, '' AS location_code,
       b.quantity, b.value, count(*) OVER () AS total
FROM erp_stock_balance b
JOIN erp_material m ON m.code = b.material_code
LEFT JOIN erp_warehouse w ON w.code = b.warehouse_code
WHERE b.unit_code = @unit
  AND (@warehouse::varchar IS NULL OR b.warehouse_code = @warehouse)
  AND (@material::varchar IS NULL OR b.material_code = @material)
  AND (@includeZero OR b.quantity <> 0)
  AND (@search::varchar IS NULL OR sys_search_match(b.material_code, @search) OR sys_search_match(m.name, @search))
ORDER BY b.warehouse_code, b.material_code
LIMIT @pageSize OFFSET @offset;
