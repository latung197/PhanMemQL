-- Tham chiếu cột -> danh mục (docs/tham-chieu-danh-muc.md).
-- Hệ thống không dùng khóa ngoại, nên bảng này ghi lại cột nào chứa mã của danh mục nào. Nội dung do API ghi mỗi lần
-- khởi động từ các thuộc tính [References<T>] của entity (không sửa tay); khung danh mục dùng nó để từ chối xóa dòng
-- còn được dùng. Script chạy lại được.

CREATE TABLE IF NOT EXISTS sys_table_ref (
    table_name   varchar(64)  NOT NULL,
    column_name  varchar(64)  NOT NULL,
    ref_table    varchar(64)  NOT NULL,
    ref_column   varchar(64)  NOT NULL,
    table_kind   varchar(16)  NOT NULL,
    blocks_delete boolean     NOT NULL DEFAULT true,
    optional     boolean      NOT NULL DEFAULT false,
    entity_type  varchar(100) NOT NULL,
    synced_at    timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (table_name, column_name)
);
CREATE INDEX IF NOT EXISTS ix_sys_table_ref_target ON sys_table_ref (ref_table);

-- Xóa một dòng danh mục tra từng cột tham chiếu theo mã, nên mỗi cột cần một chỉ mục bắt đầu bằng chính nó.
CREATE INDEX IF NOT EXISTS ix_erp_goods_receipt_currency ON erp_goods_receipt (currency_code);
CREATE INDEX IF NOT EXISTS ix_sys_approval_rule_unit ON sys_approval_rule (unit_code);
CREATE INDEX IF NOT EXISTS ix_sys_voucher_sequence_unit ON sys_voucher_sequence (unit_code);

-- Xem cấu trúc thật của database kèm tham chiếu đã khai báo: bảng, cột, kiểu, có chỉ mục không, trỏ tới đâu.
--   select * from sys_v_columns where table_name = 'erp_uom_conversion';
--   select * from sys_v_columns where ref_table = 'erp_uom';          -- mọi cột đang dùng đơn vị tính
--   select * from sys_v_columns where indexed = false and ref_table is not null;   -- tham chiếu thiếu chỉ mục
CREATE OR REPLACE VIEW sys_v_columns AS
SELECT c.table_name,
       c.column_name,
       c.ordinal_position,
       c.data_type,
       c.character_maximum_length AS max_length,
       (c.is_nullable = 'YES')    AS nullable,
       EXISTS (
           SELECT 1
           FROM pg_index i
           JOIN pg_class t ON t.oid = i.indrelid
           JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = c.table_schema
           JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[0]
           WHERE t.relname = c.table_name AND a.attname = c.column_name
       )                          AS indexed,
       r.ref_table,
       r.ref_column,
       r.blocks_delete,
       r.optional                 AS ref_optional,
       r.table_kind
FROM information_schema.columns c
LEFT JOIN sys_table_ref r ON r.table_name = c.table_name AND r.column_name = c.column_name
WHERE c.table_schema = 'public'
  AND (c.table_name LIKE 'sys\_%' OR c.table_name LIKE 'erp\_%');
