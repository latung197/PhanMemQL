-- Cấp duyệt theo trạng thái chứng từ (Duyệt cấp 1 / Duyệt cấp 2 / Đã duyệt). Chạy lại được; chạy sau 62.
--
-- Mỗi bước duyệt của sys_document_approval nhớ trạng thái chứng từ mà bước đó đưa chứng từ tới khi được duyệt:
-- APPROVED1, APPROVED2 (hai cấp trung gian mà đơn vị bật ở Cài đặt › Trạng thái chứng từ) hoặc APPROVED (cấp cuối).
-- Null ở các bước ghi trước khi có cột này = APPROVED, nên không cần chuyển dữ liệu cũ.
-- Quyền ST_APPROVED1 / ST_APPROVED2 của từng đơn vị lưu trong sys_role_right / sys_user_right như các quyền ST_* khác,
-- không cần bảng mới.

ALTER TABLE sys_document_approval ADD COLUMN IF NOT EXISTS target_status varchar(20);
