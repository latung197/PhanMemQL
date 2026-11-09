-- Tồn kho tức thời, giữ chỗ và khả dụng (hàm rpt_stock_availability).
SELECT * FROM rpt_stock_availability(@unit, @warehouse::text, @materialGroup::text, @search::text, @includeZero);
