-- System: month locks (khóa sổ) per company unit. Safe to rerun. Run after 02-company-units.sql and 04-system-config.sql.
-- A missing row means the month is open.

CREATE TABLE IF NOT EXISTS sys_fiscal_period (
    unit_code varchar(20) NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
    is_locked boolean NOT NULL DEFAULT false,
    locked_by_user_id integer,
    locked_at_utc timestamp with time zone,
    PRIMARY KEY (unit_code, year, month)
);

-- Older versions kept one list of locked months for everybody in the fiscalConfig setting ("months");
-- every company unit gets those locks, then the list and the old "lockDate" are removed from the setting.
INSERT INTO sys_fiscal_period (unit_code, year, month, is_locked, locked_at_utc)
SELECT u.code, (m->>'year')::int, (m->>'month')::int, true, now()
FROM sys_setting s
CROSS JOIN LATERAL jsonb_array_elements(s.value::jsonb -> 'months') AS m
CROSS JOIN sys_company_unit u
WHERE s.key = 'FRONTEND_FISCAL_CONFIG' AND s.scope = 'GLOBAL'
  AND jsonb_typeof(s.value::jsonb -> 'months') = 'array'
  AND coalesce((m->>'isLocked')::boolean, false)
ON CONFLICT (unit_code, year, month) DO NOTHING;

UPDATE sys_setting SET value = (value::jsonb - 'months' - 'lockDate')::text
WHERE key = 'FRONTEND_FISCAL_CONFIG' AND (value::jsonb ? 'months' OR value::jsonb ? 'lockDate');
