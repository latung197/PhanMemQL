-- The approved purchase invoices behind one supplier of the payables report (oldest due date first).
SELECT i.id, i.code, i.document_date AS date, i.invoice_no, i.invoice_series, i.invoice_date, i.due_date,
       (@asof::date - i.due_date)::int AS days_overdue, i.currency_code, i.total_value AS value
FROM erp_purchase_invoice i
WHERE i.unit_code = @unit AND i.status = 'Approved' AND i.supplier_code = @supplier
  AND i.document_date <= @asof::date AND (@from::date IS NULL OR i.document_date >= @from::date)
ORDER BY i.due_date, i.id;
