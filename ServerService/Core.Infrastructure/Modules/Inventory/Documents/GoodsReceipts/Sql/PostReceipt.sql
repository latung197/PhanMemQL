INSERT INTO erp_stock_movement
    (source_function, source_id, source_line_id, unit_code, warehouse_code, product_code, document_date, quantity, value)
SELECT 'inv_receipt', r.id, l.id, r.unit_code, r.warehouse_code, l.product_code, r.document_date,
       l.quantity, round(l.amount * r.exchange_rate, 2)
FROM erp_goods_receipt r
JOIN erp_goods_receipt_line l ON l.receipt_id = r.id AND l.kind = 'ITEM'
WHERE r.id = @receiptId;
