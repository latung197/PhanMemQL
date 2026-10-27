-- Payables per supplier of one company unit (base currency): the approved purchase invoices booked on or before @asof (and on or after
-- @from when given), split into not yet due and overdue, the overdue part by age past the due date. @asof is never null here.
SELECT i.supplier_code,
       coalesce(max(s.name), max(i.supplier_name), i.supplier_code) AS supplier_name,
       count(*)::int AS invoice_count,
       (count(*) FILTER (WHERE i.due_date < @asof::date))::int AS overdue_count,
       min(i.due_date) AS oldest_due_date,
       sum(i.total_value) AS total,
       coalesce(sum(i.total_value) FILTER (WHERE i.due_date >= @asof::date), 0) AS not_due,
       coalesce(sum(i.total_value) FILTER (WHERE i.due_date < @asof::date), 0) AS overdue,
       coalesce(sum(i.total_value) FILTER (WHERE @asof::date - i.due_date BETWEEN 1 AND 30), 0) AS over1_to30,
       coalesce(sum(i.total_value) FILTER (WHERE @asof::date - i.due_date BETWEEN 31 AND 60), 0) AS over31_to60,
       coalesce(sum(i.total_value) FILTER (WHERE @asof::date - i.due_date BETWEEN 61 AND 90), 0) AS over61_to90,
       coalesce(sum(i.total_value) FILTER (WHERE @asof::date - i.due_date > 90), 0) AS over90
FROM erp_purchase_invoice i
LEFT JOIN erp_supplier s ON s.code = i.supplier_code
WHERE i.unit_code = @unit AND i.status = 'Approved'
  AND i.document_date <= @asof::date AND (@from::date IS NULL OR i.document_date >= @from::date)
  AND (@supplier::varchar IS NULL OR i.supplier_code = @supplier)
  AND (@search::varchar IS NULL OR sys_search_match(i.supplier_code, @search) OR sys_search_match(coalesce(s.name, i.supplier_name, ''), @search))
GROUP BY i.supplier_code
ORDER BY overdue DESC, i.supplier_code;
