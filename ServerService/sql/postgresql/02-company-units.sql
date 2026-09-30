-- System: company units (đơn vị cơ sở) and the units each user may sign in to. Safe to rerun.
-- Older versions named these tables erp_unit / erp_user_unit with "PascalCase" columns; they are renamed.

SELECT sys_rename_table('erp_unit', 'sys_company_unit');
SELECT sys_rename_column('sys_company_unit', 'Code', 'code');
SELECT sys_rename_column('sys_company_unit', 'Name', 'name');
SELECT sys_rename_column('sys_company_unit', 'ShortName', 'short_name');
SELECT sys_rename_column('sys_company_unit', 'Address', 'address');
SELECT sys_rename_column('sys_company_unit', 'Phone', 'phone');
SELECT sys_rename_column('sys_company_unit', 'Email', 'email');
SELECT sys_rename_column('sys_company_unit', 'TaxCode', 'tax_code');
SELECT sys_rename_column('sys_company_unit', 'IsActive', 'is_active');
SELECT sys_rename_column('sys_company_unit', 'IsDefault', 'is_default');
SELECT sys_rename_column('sys_company_unit', 'SortOrder', 'sort_order');
SELECT sys_rename_constraint('sys_company_unit', 'erp_unit_pkey', 'sys_company_unit_pkey');

CREATE TABLE IF NOT EXISTS sys_company_unit (
    code varchar(20) PRIMARY KEY,
    name varchar(150) NOT NULL,
    short_name varchar(100),
    address varchar(300),
    phone varchar(30),
    email varchar(150),
    tax_code varchar(30),
    is_active boolean NOT NULL DEFAULT true,
    is_default boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0
);
ALTER TABLE sys_company_unit ADD COLUMN IF NOT EXISTS short_name varchar(100);
ALTER TABLE sys_company_unit ADD COLUMN IF NOT EXISTS address varchar(300);
ALTER TABLE sys_company_unit ADD COLUMN IF NOT EXISTS phone varchar(30);
ALTER TABLE sys_company_unit ADD COLUMN IF NOT EXISTS email varchar(150);
ALTER TABLE sys_company_unit ADD COLUMN IF NOT EXISTS tax_code varchar(30);
ALTER TABLE sys_company_unit ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

SELECT sys_rename_table('erp_user_unit', 'sys_user_company_unit');
SELECT sys_rename_column('sys_user_company_unit', 'UserId', 'user_id');
SELECT sys_rename_column('sys_user_company_unit', 'UnitCode', 'unit_code');
SELECT sys_rename_constraint('sys_user_company_unit', 'erp_user_unit_pkey', 'sys_user_company_unit_pkey');
SELECT sys_rename_constraint('sys_user_company_unit', 'ix_erp_user_unit_unit', 'ix_sys_user_company_unit_unit');

CREATE TABLE IF NOT EXISTS sys_user_company_unit (
    user_id integer NOT NULL,
    unit_code varchar(20) NOT NULL,
    PRIMARY KEY (user_id, unit_code)
);
SELECT sys_drop_foreign_keys('sys_user_company_unit');
CREATE INDEX IF NOT EXISTS ix_sys_user_company_unit_unit ON sys_user_company_unit (unit_code);
