-- Latest entries of the change log of the unit.
SELECT log_time AS time, actor_name, function_code AS function, action, object_label AS label
FROM sys_audit_log
WHERE unit_code = @unit
ORDER BY log_time DESC, id DESC
LIMIT @top;
