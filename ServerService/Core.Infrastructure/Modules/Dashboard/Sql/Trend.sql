-- Posted goods receipts and issues of the unit per month since @from (base currency).
SELECT to_char(date_trunc('month', document_date), 'YYYY-MM') AS month, 'R' AS kind, count(*)::int AS n, coalesce(sum(total_value), 0) AS value
FROM erp_goods_receipt
WHERE unit_code = @unit AND status = 'Posted' AND document_date >= @from
GROUP BY 1
UNION ALL
SELECT to_char(date_trunc('month', document_date), 'YYYY-MM'), 'I', count(*)::int, coalesce(sum(total_value), 0)
FROM erp_goods_issue
WHERE unit_code = @unit AND status = 'Posted' AND document_date >= @from
GROUP BY 1;
