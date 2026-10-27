-- Book stock of one warehouse of one company unit as of a date, straight from the stock ledger (erp_stock_movement, which also
-- holds the reversal rows, so the plain sum is right). One row per material, and per lot / location for the materials that track
-- them. material_quantity / material_value are the totals of the material in the warehouse: value / quantity is the moving
-- average cost the ledger values stock going out at.
SELECT s.material_code,
       CASE WHEN m.track_lot THEN coalesce(s.lot_code, '') ELSE '' END AS lot_code,
       CASE WHEN m.track_location THEN coalesce(s.location_code, '') ELSE '' END AS location_code,
       sum(s.quantity) AS quantity,
       sum(sum(s.quantity)) OVER (PARTITION BY s.material_code) AS material_quantity,
       sum(sum(s.value)) OVER (PARTITION BY s.material_code) AS material_value
FROM erp_stock_movement s
JOIN erp_material m ON m.code = s.material_code
WHERE s.unit_code = @unit
  AND s.warehouse_code = @warehouse
  AND s.document_date <= @asOf
GROUP BY s.material_code, 2, 3
ORDER BY s.material_code, 2, 3;
