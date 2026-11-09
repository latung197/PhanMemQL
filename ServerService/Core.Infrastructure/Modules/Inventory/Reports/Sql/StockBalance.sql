-- Tồn kho tại một ngày (hàm rpt_stock_balance, script 55-inventory-reports.sql).
SELECT * FROM rpt_stock_balance(@unit, @asof::date, @warehouse::text, @materialGroup::text, @search::text, @includeZero);
