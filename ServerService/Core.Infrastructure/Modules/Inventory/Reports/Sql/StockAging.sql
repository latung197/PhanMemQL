-- Tuổi hàng tồn tại một ngày (hàm rpt_stock_aging).
SELECT * FROM rpt_stock_aging(@unit, @asof::date, @warehouse::text, @materialGroup::text, @search::text);
