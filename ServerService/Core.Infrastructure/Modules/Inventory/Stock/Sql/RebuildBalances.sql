-- Rebuilds the three balance tables from the stock ledger for one company unit (@unit = null: every unit): the balance of
-- a key is the sum of its ledger rows (reversal rows included). Used after a repair; normal posting keeps them in step.
DELETE FROM erp_stock_balance WHERE (@unit::varchar IS NULL OR unit_code = @unit);
DELETE FROM erp_stock_lot_balance WHERE (@unit::varchar IS NULL OR unit_code = @unit);
DELETE FROM erp_stock_location_balance WHERE (@unit::varchar IS NULL OR unit_code = @unit);

INSERT INTO erp_stock_balance (unit_code, warehouse_code, material_code, quantity, value, created_by)
SELECT unit_code, warehouse_code, material_code, sum(quantity), sum(value), @user
FROM erp_stock_movement WHERE (@unit::varchar IS NULL OR unit_code = @unit)
GROUP BY unit_code, warehouse_code, material_code;

INSERT INTO erp_stock_lot_balance (unit_code, warehouse_code, material_code, lot_code, quantity, created_by)
SELECT unit_code, warehouse_code, material_code, lot_code, sum(quantity), @user
FROM erp_stock_movement WHERE lot_code IS NOT NULL AND (@unit::varchar IS NULL OR unit_code = @unit)
GROUP BY unit_code, warehouse_code, material_code, lot_code;

INSERT INTO erp_stock_location_balance (unit_code, warehouse_code, material_code, lot_code, location_code, quantity, created_by)
SELECT unit_code, warehouse_code, material_code, COALESCE(lot_code, ''), location_code, sum(quantity), @user
FROM erp_stock_movement WHERE location_code IS NOT NULL AND (@unit::varchar IS NULL OR unit_code = @unit)
GROUP BY unit_code, warehouse_code, material_code, COALESCE(lot_code, ''), location_code;
