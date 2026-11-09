-- Giá trung bình tháng (hàm rpt_stock_monthly_cost).
SELECT * FROM rpt_stock_monthly_cost(@unit, @from::date, @to::date, @warehouse::text, @materialGroup::text, @search::text, @includeZero);
