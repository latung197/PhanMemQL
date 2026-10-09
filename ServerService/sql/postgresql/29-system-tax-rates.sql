-- System: tax rates (mã thuế: VAT, import duty...). Safe to rerun. Run after 24-table-ref.sql.
-- Materials and vouchers point to a tax with a column such as tax_rate_code / import_tax_rate_code (not tax_code: that is
-- the tax identification number of a company or supplier).
CREATE TABLE IF NOT EXISTS sys_tax_rate (
    code varchar(20) PRIMARY KEY,
    name varchar(100) NOT NULL,
    tax_type varchar(10) NOT NULL DEFAULT 'VAT',
    rate numeric(7,4) NOT NULL DEFAULT 0,
    is_exempt boolean NOT NULL DEFAULT false,
    note varchar(300),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    CONSTRAINT ck_sys_tax_rate_type CHECK (tax_type IN ('VAT', 'IMPORT', 'OTHER')),
    CONSTRAINT ck_sys_tax_rate_rate CHECK (rate >= 0 AND rate <= 100)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sys_tax_rate_name ON sys_tax_rate (lower(name));

-- Common Vietnamese rates, only when the table is still empty.
INSERT INTO sys_tax_rate (code, name, tax_type, rate, is_exempt, note, sort_order)
SELECT v.code, v.name, v.tax_type, v.rate, v.is_exempt, v.note, v.sort_order
FROM (VALUES
    ('VAT0',  'Thuế GTGT 0%',          'VAT',    0::numeric,  false, 'Hàng xuất khẩu', 1),
    ('VAT5',  'Thuế GTGT 5%',          'VAT',    5::numeric,  false, NULL, 2),
    ('VAT8',  'Thuế GTGT 8%',          'VAT',    8::numeric,  false, NULL, 3),
    ('VAT10', 'Thuế GTGT 10%',         'VAT',    10::numeric, false, NULL, 4),
    ('KCT',   'Không chịu thuế GTGT',  'VAT',    0::numeric,  true,  'Không phải kê khai tính nộp thuế', 5),
    ('NK00',  'Thuế nhập khẩu 0%',     'IMPORT', 0::numeric,  false, NULL, 6),
    ('NK05',  'Thuế nhập khẩu 5%',     'IMPORT', 5::numeric,  false, NULL, 7),
    ('NK10',  'Thuế nhập khẩu 10%',    'IMPORT', 10::numeric, false, NULL, 8)
) AS v(code, name, tax_type, rate, is_exempt, note, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM sys_tax_rate);
