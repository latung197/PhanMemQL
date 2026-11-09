-- Bảng kê hàng nhập / xuất gộp theo kho + vật tư (hàm rpt_stock_movement_summary).
SELECT * FROM rpt_stock_movement_summary(@unit, @direction, @from::date, @to::date, @warehouse::text, @materialGroup::text, @search::text);
