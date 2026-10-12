-- Kho: xóa một phiếu nhập / xuất thì xóa luôn dòng chi tiết và dấu vết trong sổ kho. Chạy lại được; chạy sau 20, 34, 39.
-- Dự án không dùng khóa ngoại, nên trigger này là lớp bảo vệ ở mức database (dịch vụ vẫn tự xóa dòng phiếu như cũ):
--   * Phiếu còn đang ghi sổ (sổ kho của phiếu chưa triệt tiêu về 0 theo kho / vật tư / lô / vị trí) thì KHÔNG cho xóa: xóa sổ kho
--     lúc này sẽ làm ba bảng tồn (erp_stock_balance, erp_stock_lot_balance, erp_stock_location_balance) lệch so với sổ.
--   * Phiếu đã bỏ ghi sổ: sổ chỉ còn các cặp dòng ghi và dòng đảo cộng lại bằng 0, nên xóa các dòng sổ đó không làm đổi tồn;
--     ba bảng tồn vẫn đúng, không cần tính lại.
--   * Dòng chi tiết của phiếu (erp_goods_receipt_line / erp_goods_issue_line) luôn bị xóa theo đầu phiếu.
-- Lịch sử duyệt (sys_document_approval) và nhật ký thay đổi (sys_audit_log) được giữ lại làm bằng chứng.
CREATE OR REPLACE FUNCTION erp_voucher_delete_cleanup() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
    -- Tham số của trigger: chức năng ghi sổ ('inv_receipt'), bảng dòng, cột trỏ về đầu phiếu.
    source_fn text := TG_ARGV[0];
    line_table text := TG_ARGV[1];
    line_key text := TG_ARGV[2];
BEGIN
    IF EXISTS (
        SELECT 1 FROM erp_stock_movement
        WHERE source_function = source_fn AND source_id = OLD.id
        GROUP BY warehouse_code, material_code, coalesce(lot_code, ''), coalesce(location_code, '')
        HAVING sum(quantity) <> 0 OR sum(value) <> 0
    ) THEN
        RAISE EXCEPTION 'Phiếu % đang ghi sổ kho: phải bỏ ghi sổ trước khi xóa.', OLD.code USING ERRCODE = 'P0001';
    END IF;

    EXECUTE format('DELETE FROM %I WHERE %I = $1', line_table, line_key) USING OLD.id;
    DELETE FROM erp_stock_movement WHERE source_function = source_fn AND source_id = OLD.id;
    RETURN OLD;
END
$fn$;

DROP TRIGGER IF EXISTS trg_erp_goods_receipt_delete ON erp_goods_receipt;
CREATE TRIGGER trg_erp_goods_receipt_delete BEFORE DELETE ON erp_goods_receipt
    FOR EACH ROW EXECUTE FUNCTION erp_voucher_delete_cleanup('inv_receipt', 'erp_goods_receipt_line', 'receipt_id');

DROP TRIGGER IF EXISTS trg_erp_goods_issue_delete ON erp_goods_issue;
CREATE TRIGGER trg_erp_goods_issue_delete BEFORE DELETE ON erp_goods_issue
    FOR EACH ROW EXECUTE FUNCTION erp_voucher_delete_cleanup('inv_issue', 'erp_goods_issue_line', 'issue_id');
