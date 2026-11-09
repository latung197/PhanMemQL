-- Vai trò theo từng đơn vị cơ sở: mỗi đơn vị người dùng được vào có thể gắn một vai trò riêng (role_id).
-- Trống = dùng vai trò mặc định của người dùng (sys_user_role). Quyền của người dùng ở một đơn vị = vai trò của đơn vị đó
-- (hoặc vai trò mặc định) cộng các ngoại lệ riêng của người dùng (áp dụng ở mọi đơn vị). Không gắn vai trò quản trị theo đơn vị.
-- Dữ liệu cũ giữ nguyên: mọi đơn vị đang dùng vai trò mặc định. Chạy lại được.
ALTER TABLE sys_user_company_unit ADD COLUMN IF NOT EXISTS role_id integer;
-- Xóa vai trò tra ai đang dùng nó theo đơn vị; tìm người duyệt theo vai trò tra theo đơn vị.
CREATE INDEX IF NOT EXISTS ix_sys_user_company_unit_role_id ON sys_user_company_unit (role_id) WHERE role_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_sys_user_company_unit_unit_role ON sys_user_company_unit (unit_code, role_id) WHERE role_id IS NOT NULL;
