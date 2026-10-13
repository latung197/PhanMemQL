-- Đơn mua hàng: ngày dự kiến nhận hàng theo từng dòng. Mặc định mỗi dòng theo ngày giao hàng ở đầu đơn; dòng nào giao khác thì sửa riêng.
-- Chạy lại được; chạy sau 44. Dòng của đơn cũ lấy ngày giao ở đầu đơn (nếu có).
ALTER TABLE erp_purchase_order_line ADD COLUMN IF NOT EXISTS delivery_date date;

UPDATE erp_purchase_order_line l
SET delivery_date = o.delivery_date
FROM erp_purchase_order o
WHERE o.id = l.order_id AND l.delivery_date IS NULL AND o.delivery_date IS NOT NULL;
