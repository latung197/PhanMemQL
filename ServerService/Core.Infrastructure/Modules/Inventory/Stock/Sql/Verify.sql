-- Differences between the stock ledger and the three balance tables: one row per key whose ledger sum differs from the
-- balance (a missing balance counts as 0). No rows = all is well. @unit = null checks every company unit.
SELECT 'warehouse' AS level,
       COALESCE(l.unit_code, b.unit_code) AS unit_code, COALESCE(l.warehouse_code, b.warehouse_code) AS warehouse_code,
       COALESCE(l.material_code, b.material_code) AS material_code, '' AS lot_code, '' AS location_code,
       COALESCE(l.quantity, 0) AS ledger_quantity, COALESCE(b.quantity, 0) AS balance_quantity,
       COALESCE(l.value, 0) AS ledger_value, COALESCE(b.value, 0) AS balance_value
FROM (SELECT unit_code, warehouse_code, material_code, sum(quantity) AS quantity, sum(value) AS value
      FROM erp_stock_movement WHERE (@unit::varchar IS NULL OR unit_code = @unit)
      GROUP BY unit_code, warehouse_code, material_code) l
FULL JOIN (SELECT unit_code, warehouse_code, material_code, quantity, value
           FROM erp_stock_balance WHERE (@unit::varchar IS NULL OR unit_code = @unit)) b
  ON b.unit_code = l.unit_code AND b.warehouse_code = l.warehouse_code AND b.material_code = l.material_code
WHERE COALESCE(l.quantity, 0) <> COALESCE(b.quantity, 0) OR COALESCE(l.value, 0) <> COALESCE(b.value, 0)

UNION ALL
SELECT 'lot',
       COALESCE(l.unit_code, b.unit_code), COALESCE(l.warehouse_code, b.warehouse_code), COALESCE(l.material_code, b.material_code),
       COALESCE(l.lot_code, b.lot_code), '', COALESCE(l.quantity, 0), COALESCE(b.quantity, 0), 0, 0
FROM (SELECT unit_code, warehouse_code, material_code, lot_code, sum(quantity) AS quantity
      FROM erp_stock_movement WHERE lot_code IS NOT NULL AND (@unit::varchar IS NULL OR unit_code = @unit)
      GROUP BY unit_code, warehouse_code, material_code, lot_code) l
FULL JOIN (SELECT unit_code, warehouse_code, material_code, lot_code, quantity
           FROM erp_stock_lot_balance WHERE (@unit::varchar IS NULL OR unit_code = @unit)) b
  ON b.unit_code = l.unit_code AND b.warehouse_code = l.warehouse_code AND b.material_code = l.material_code AND b.lot_code = l.lot_code
WHERE COALESCE(l.quantity, 0) <> COALESCE(b.quantity, 0)

UNION ALL
SELECT 'location',
       COALESCE(l.unit_code, b.unit_code), COALESCE(l.warehouse_code, b.warehouse_code), COALESCE(l.material_code, b.material_code),
       COALESCE(l.lot_code, b.lot_code), COALESCE(l.location_code, b.location_code), COALESCE(l.quantity, 0), COALESCE(b.quantity, 0), 0, 0
FROM (SELECT unit_code, warehouse_code, material_code, COALESCE(lot_code, '') AS lot_code, location_code, sum(quantity) AS quantity
      FROM erp_stock_movement WHERE location_code IS NOT NULL AND (@unit::varchar IS NULL OR unit_code = @unit)
      GROUP BY unit_code, warehouse_code, material_code, COALESCE(lot_code, ''), location_code) l
FULL JOIN (SELECT unit_code, warehouse_code, material_code, lot_code, location_code, quantity
           FROM erp_stock_location_balance WHERE (@unit::varchar IS NULL OR unit_code = @unit)) b
  ON b.unit_code = l.unit_code AND b.warehouse_code = l.warehouse_code AND b.material_code = l.material_code
     AND b.lot_code = l.lot_code AND b.location_code = l.location_code
WHERE COALESCE(l.quantity, 0) <> COALESCE(b.quantity, 0)

ORDER BY 1, 2, 3, 4, 5, 6;
