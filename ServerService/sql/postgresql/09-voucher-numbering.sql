-- System: voucher number series. Safe to rerun.
-- The API creates one rule per voucher of VoucherCatalog at startup (taking over the old
-- systemDefaults.autoNumbering values); counters are only changed by Modules/VoucherNumbering/Sql/NextNumber.sql.

CREATE TABLE IF NOT EXISTS sys_voucher_numbering (
    voucher_type varchar(20) PRIMARY KEY,           -- PNK, PXK, ...
    menuid0 varchar(64) NOT NULL,                   -- voucher function, e.g. inv_receipt
    name varchar(100) NOT NULL,
    prefix varchar(20) NOT NULL,
    pattern varchar(100) NOT NULL,                  -- {PREFIX} {DVCS} {YYYY} {YY} {MM} {DD} {SEQ}
    digits smallint NOT NULL DEFAULT 4,
    updated_at_utc timestamp with time zone,
    updated_by_user_id integer
);

-- Last number issued per voucher type, company unit and period (yyyy, yyyyMM, yyyyMMdd or ALL).
CREATE TABLE IF NOT EXISTS sys_voucher_sequence (
    voucher_type varchar(20) NOT NULL,
    unit_code varchar(20) NOT NULL,
    period_key varchar(8) NOT NULL,
    last_number integer NOT NULL DEFAULT 0,
    PRIMARY KEY (voucher_type, unit_code, period_key)
);
