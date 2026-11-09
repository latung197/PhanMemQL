-- Bảng kê hàng nhập (@direction = 1) hoặc xuất (-1) theo từng dòng sổ kho (hàm rpt_stock_movements); lấy dư một dòng để biết có vượt giới hạn.
SELECT * FROM rpt_stock_movements(@unit, @direction, @from::date, @to::date, @warehouse::text, @materialGroup::text, @search::text, @limit);
