-- Cost per project of one company unit (base currency). Voucher dates are cut by @from / @to (null = all); the project list is not.
-- Ordered = approved purchase orders (committed), received = posted goods receipts, issued = posted goods issues (the cost consumed).
WITH po AS (
    SELECT project_code, sum(total_value) AS value, count(*)::int AS n FROM erp_purchase_order
    WHERE unit_code = @unit AND project_code IS NOT NULL AND status = 'Approved'
      AND (@from::date IS NULL OR document_date >= @from) AND (@to::date IS NULL OR document_date <= @to)
    GROUP BY project_code
), gr AS (
    SELECT project_code, sum(total_value) AS value, count(*)::int AS n FROM erp_goods_receipt
    WHERE unit_code = @unit AND project_code IS NOT NULL AND status = 'Posted'
      AND (@from::date IS NULL OR document_date >= @from) AND (@to::date IS NULL OR document_date <= @to)
    GROUP BY project_code
), gi AS (
    SELECT project_code, sum(total_value) AS value, count(*)::int AS n FROM erp_goods_issue
    WHERE unit_code = @unit AND project_code IS NOT NULL AND status = 'Posted'
      AND (@from::date IS NULL OR document_date >= @from) AND (@to::date IS NULL OR document_date <= @to)
    GROUP BY project_code
), pr AS (
    SELECT project_code, count(*)::int AS n FROM erp_purchase_request
    WHERE unit_code = @unit AND project_code IS NOT NULL AND status IN ('Approved', 'Pending')
      AND (@from::date IS NULL OR document_date >= @from) AND (@to::date IS NULL OR document_date <= @to)
    GROUP BY project_code
)
SELECT p.code, p.name, p.status, p.customer_name, p.manager_name, p.start_date, p.end_date, p.budget,
       coalesce(po.value, 0) AS ordered_value, coalesce(gr.value, 0) AS received_value, coalesce(gi.value, 0) AS issued_value,
       coalesce(pr.n, 0) AS request_count, coalesce(po.n, 0) AS order_count, coalesce(gr.n, 0) AS receipt_count, coalesce(gi.n, 0) AS issue_count
FROM erp_project p
LEFT JOIN po ON po.project_code = p.code
LEFT JOIN gr ON gr.project_code = p.code
LEFT JOIN gi ON gi.project_code = p.code
LEFT JOIN pr ON pr.project_code = p.code
WHERE (@project::varchar IS NULL OR p.code = @project)
  AND (@status::varchar IS NULL OR p.status = @status)
  AND (@search::varchar IS NULL OR sys_search_match(p.code, @search) OR sys_search_match(p.name, @search)
       OR sys_search_match(coalesce(p.customer_name, ''), @search) OR sys_search_match(coalesce(p.manager_name, ''), @search))
ORDER BY p.code;
