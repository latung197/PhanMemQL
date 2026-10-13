-- Vouchers of one project in one company unit (every kind), newest first.
SELECT kind, id, code, document_date AS date, status, partner, value FROM (
    SELECT 'pur_request' AS kind, id, code, document_date, status, supplier_name AS partner, total_value AS value FROM erp_purchase_request
    WHERE unit_code = @unit AND project_code = @project
    UNION ALL
    SELECT 'pur_order', id, code, document_date, status, supplier_name, total_value FROM erp_purchase_order
    WHERE unit_code = @unit AND project_code = @project
    UNION ALL
    SELECT 'inv_receipt', id, code, document_date, status, supplier_name, total_value FROM erp_goods_receipt
    WHERE unit_code = @unit AND project_code = @project
    UNION ALL
    SELECT 'inv_issue', id, code, document_date, status, customer_name, total_value FROM erp_goods_issue
    WHERE unit_code = @unit AND project_code = @project
    UNION ALL
    SELECT 'inv_issue_request', id, code, document_date, status, customer_name, total_value FROM erp_issue_request
    WHERE unit_code = @unit AND project_code = @project
) v
WHERE (@from::date IS NULL OR document_date >= @from) AND (@to::date IS NULL OR document_date <= @to)
ORDER BY document_date DESC, code DESC;
