-- Trạng thái chứng từ theo đơn vị cơ sở + quyền theo trạng thái theo đơn vị cơ sở. Chạy lại được; chạy sau 42.
--
-- 1. sys_voucher_status: chỉ lưu cái đơn vị đã đổi (tên, tên tiếng Anh, tắt trạng thái); trạng thái khai báo trong code
--    (VoucherStatusCatalog), nên một dòng thiếu nghĩa là tên mặc định và đang dùng.
-- 2. Quyền trạng thái ST_PENDING / ST_APPROVED / ST_POSTED / ST_CANCELLED / ST_UNPOST gắn với đơn vị: mã lưu trong sys_role_right /
--    sys_user_right có dạng "ST_POSTED@DVCS01". Lần chạy đầu đổi quyền cũ sang quyền mới, mở ra cho mọi đơn vị (vai trò) hoặc các đơn
--    vị của người dùng, để không ai mất quyền đang có:
--      EDIT_PENDING -> ST_PENDING, EDIT_APPROVED -> ST_APPROVED, POST -> ST_POSTED, UNPOST -> ST_UNPOST, CANCEL -> ST_CANCELLED.
--    Trước đây ai thêm / sửa được phiếu thì gửi duyệt được, ai có quyền "Duyệt" (trên phiếu hoặc màn phê duyệt) thì lưu thẳng ở
--    trạng thái đã duyệt được, nên các quyền đó cũng được cấp ST_PENDING / ST_APPROVED. Phiếu yêu cầu xuất kho không ghi sổ nên
--    không có ST_POSTED / ST_UNPOST. Quản trị viên chỉnh lại theo từng đơn vị ở Cài đặt › Người dùng & phân quyền.
--    Chỉ chạy một lần: dấu hiệu là bảng sys_voucher_status chưa có.

DO $migrate$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'sys_voucher_status') THEN
        RETURN;
    END IF;

    CREATE TEMP TABLE tmp_old_rights (old_code varchar(50), new_code varchar(50)) ON COMMIT DROP;
    INSERT INTO tmp_old_rights VALUES ('EDIT_PENDING', 'ST_PENDING'), ('EDIT_APPROVED', 'ST_APPROVED'), ('POST', 'ST_POSTED'),
        ('UNPOST', 'ST_UNPOST'), ('CANCEL', 'ST_CANCELLED');

    -- Chức năng chứng từ và màn phê duyệt của nó (VoucherCatalog); hàm có ghi sổ.
    CREATE TEMP TABLE tmp_vouchers (fn varchar(64), posts boolean) ON COMMIT DROP;
    INSERT INTO tmp_vouchers VALUES ('inv_receipt', true), ('inv_issue_request', false), ('inv_issue', true), ('inv_transfer_order', true),
        ('inv_transfer_issue', true), ('inv_transfer_receipt', true), ('inv_audit_count', true), ('sales_orders', true),
        ('sales_delivery', true), ('fin_receipt_voucher', true), ('fin_payment_voucher', true);
    CREATE TEMP TABLE tmp_screens (screen varchar(64), fn varchar(64)) ON COMMIT DROP;
    INSERT INTO tmp_screens VALUES ('inv_approve_receipt', 'inv_receipt'), ('inv_approve_issue', 'inv_issue'),
        ('inv_approve_issue_request', 'inv_issue_request'), ('inv_approve_transfer', 'inv_transfer_order'),
        ('inv_approve_transfer', 'inv_transfer_issue'), ('inv_approve_transfer', 'inv_transfer_receipt');

    -- Vai trò: quyền cũ -> quyền mới cho mọi đơn vị.
    INSERT INTO sys_role_right (role_id, menuid0, right_code, status)
    SELECT DISTINCT r.role_id, r.menuid0, m.new_code || '@' || u.code, '1'
    FROM sys_role_right r
    JOIN tmp_old_rights m ON m.old_code = r.right_code
    JOIN tmp_vouchers v ON v.fn = r.menuid0 AND (v.posts OR m.new_code NOT IN ('ST_POSTED', 'ST_UNPOST'))
    CROSS JOIN sys_company_unit u
    WHERE r.status = '1'
    ON CONFLICT DO NOTHING;

    -- Vai trò: thêm / sửa được phiếu -> ST_PENDING; được "Duyệt" (trên phiếu hoặc màn phê duyệt) -> ST_APPROVED.
    INSERT INTO sys_role_right (role_id, menuid0, right_code, status)
    SELECT DISTINCT c.role_id, v.fn, 'ST_PENDING@' || u.code, '1'
    FROM sys_role_command c
    JOIN tmp_vouchers v ON v.fn = c.menuid0
    CROSS JOIN sys_company_unit u
    WHERE c.status = '1' AND (c.can_add OR c.can_edit)
    ON CONFLICT DO NOTHING;

    INSERT INTO sys_role_right (role_id, menuid0, right_code, status)
    SELECT DISTINCT c.role_id, v.fn, 'ST_APPROVED@' || u.code, '1'
    FROM sys_role_command c
    JOIN tmp_vouchers v ON v.fn = c.menuid0
    CROSS JOIN sys_company_unit u
    WHERE c.status = '1' AND c.can_approve
    ON CONFLICT DO NOTHING;

    INSERT INTO sys_role_right (role_id, menuid0, right_code, status)
    SELECT DISTINCT c.role_id, s.fn, 'ST_APPROVED@' || u.code, '1'
    FROM sys_role_command c
    JOIN tmp_screens s ON s.screen = c.menuid0
    CROSS JOIN sys_company_unit u
    WHERE c.status = '1' AND c.can_approve
    ON CONFLICT DO NOTHING;

    -- Người dùng: ngoại lệ quyền cũ (cấp hoặc rút) -> quyền mới cho các đơn vị của người đó.
    CREATE TEMP TABLE tmp_user_units (user_id integer, unit_code varchar(20)) ON COMMIT DROP;
    INSERT INTO tmp_user_units
    SELECT user_id, unit_code FROM sys_user_company_unit
    UNION
    SELECT user_id, ma_dvcs FROM sys_users WHERE ma_dvcs IS NOT NULL AND ma_dvcs <> '';

    INSERT INTO sys_user_right (user_id, menuid0, right_code, status, is_granted)
    SELECT DISTINCT r.user_id, r.menuid0, m.new_code || '@' || uu.unit_code, '1', r.is_granted
    FROM sys_user_right r
    JOIN tmp_old_rights m ON m.old_code = r.right_code
    JOIN tmp_vouchers v ON v.fn = r.menuid0 AND (v.posts OR m.new_code NOT IN ('ST_POSTED', 'ST_UNPOST'))
    JOIN tmp_user_units uu ON uu.user_id = r.user_id
    WHERE r.status = '1'
    ON CONFLICT DO NOTHING;

    -- Người dùng: hàng ngoại lệ ma trận có thêm / sửa -> ST_PENDING; có "Duyệt" -> ST_APPROVED.
    INSERT INTO sys_user_right (user_id, menuid0, right_code, status, is_granted)
    SELECT DISTINCT c.user_id, v.fn, 'ST_PENDING@' || uu.unit_code, '1', true
    FROM sys_user_command c
    JOIN tmp_vouchers v ON v.fn = c.menuid0
    JOIN tmp_user_units uu ON uu.user_id = c.user_id
    WHERE c.status = '1' AND (c.can_add OR c.can_edit)
    ON CONFLICT DO NOTHING;

    INSERT INTO sys_user_right (user_id, menuid0, right_code, status, is_granted)
    SELECT DISTINCT c.user_id, v.fn, 'ST_APPROVED@' || uu.unit_code, '1', true
    FROM sys_user_command c
    JOIN tmp_vouchers v ON v.fn = c.menuid0
    JOIN tmp_user_units uu ON uu.user_id = c.user_id
    WHERE c.status = '1' AND c.can_approve
    ON CONFLICT DO NOTHING;

    INSERT INTO sys_user_right (user_id, menuid0, right_code, status, is_granted)
    SELECT DISTINCT c.user_id, s.fn, 'ST_APPROVED@' || uu.unit_code, '1', true
    FROM sys_user_command c
    JOIN tmp_screens s ON s.screen = c.menuid0
    JOIN tmp_user_units uu ON uu.user_id = c.user_id
    WHERE c.status = '1' AND c.can_approve
    ON CONFLICT DO NOTHING;

    DELETE FROM sys_role_right WHERE right_code IN (SELECT old_code FROM tmp_old_rights);
    DELETE FROM sys_user_right WHERE right_code IN (SELECT old_code FROM tmp_old_rights);
END
$migrate$;

CREATE TABLE IF NOT EXISTS sys_voucher_status (
    id bigserial PRIMARY KEY,
    unit_code varchar(20) NOT NULL,
    voucher_type varchar(20) NOT NULL,
    status_code varchar(20) NOT NULL,
    name varchar(100),
    name_en varchar(100),
    is_enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    CONSTRAINT ck_sys_voucher_status_code CHECK (status_code IN ('Draft', 'Pending', 'Approved', 'Posted', 'Cancelled'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sys_voucher_status_unit_type_status ON sys_voucher_status (unit_code, voucher_type, status_code);
CREATE INDEX IF NOT EXISTS ix_sys_voucher_status_unit_code ON sys_voucher_status (unit_code);
