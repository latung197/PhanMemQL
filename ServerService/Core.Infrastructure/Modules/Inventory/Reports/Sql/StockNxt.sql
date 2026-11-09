-- Nhập xuất tồn của một kỳ (hàm rpt_stock_nxt).
SELECT * FROM rpt_stock_nxt(@unit, @from::date, @to::date, @warehouse::text, @materialGroup::text, @search::text, @includeZero);
