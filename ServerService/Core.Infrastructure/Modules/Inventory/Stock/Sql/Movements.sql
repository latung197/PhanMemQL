-- Ledger rows of one company unit, newest first (page: @pageSize, @offset). Filters are optional (null = all).
SELECT s.id, s.source_function, s.source_id, s.source_line_id, s.unit_code, s.warehouse_code, s.material_code, m.name AS material_name,
       s.lot_code, s.location_code, s.document_date, s.quantity, s.value, s.uom_code, s.line_uom_code, s.line_quantity,
       s.posting_seq, s.reversal_of_id, s.created_at, count(*) OVER () AS total
FROM erp_stock_movement s
LEFT JOIN erp_material m ON m.code = s.material_code
WHERE s.unit_code = @unit
  AND (@warehouse::varchar IS NULL OR s.warehouse_code = @warehouse)
  AND (@material::varchar IS NULL OR s.material_code = @material)
  AND (@lot::varchar IS NULL OR s.lot_code = @lot)
  AND (@location::varchar IS NULL OR s.location_code = @location)
  AND (@from::date IS NULL OR s.document_date >= @from)
  AND (@to::date IS NULL OR s.document_date <= @to)
  AND (@function::varchar IS NULL OR s.source_function = @function)
  AND (@sourceId::bigint IS NULL OR s.source_id = @sourceId)
ORDER BY s.document_date DESC, s.id DESC
LIMIT @pageSize OFFSET @offset;
