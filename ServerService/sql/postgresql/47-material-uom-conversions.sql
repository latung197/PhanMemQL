-- Inventory: the unit conversions of a material are kept on the material form (a grid), in erp_uom_conversion rows that carry the
-- material code. The code of such a row is {material}@{unit}, longer than before. Safe to rerun.
ALTER TABLE erp_uom_conversion ALTER COLUMN code TYPE varchar(80);
-- Rows that name a material the catalog does not have (old mock codes) become general conversions.
UPDATE erp_uom_conversion SET material_code = NULL, material_name = NULL
 WHERE material_code IS NOT NULL AND material_code <> '' AND NOT EXISTS (SELECT 1 FROM erp_material m WHERE m.code = erp_uom_conversion.material_code);
