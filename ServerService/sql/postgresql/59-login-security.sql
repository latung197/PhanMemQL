-- Bảo mật đăng nhập: chính sách mật khẩu (độ dài, độ phức tạp, hết hạn, không dùng lại mật khẩu cũ), chặn tạm tên đăng nhập sau nhiều lần
-- sai mật khẩu (không khóa tài khoản), tự đăng xuất khi không thao tác, lịch sử đăng nhập. Chính sách lưu ở sys_setting (khóa SECURITY_POLICY).
-- Chạy lại được.
ALTER TABLE sys_users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
ALTER TABLE sys_users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
-- Tài khoản đang có: tính như vừa đặt mật khẩu hôm chạy script, để không ai bị bắt đổi ngay.
UPDATE sys_users SET password_changed_at = now() WHERE password_changed_at IS NULL;

CREATE TABLE IF NOT EXISTS sys_login_history (
    id bigserial PRIMARY KEY,
    log_time timestamptz NOT NULL DEFAULT now(),
    user_name varchar(100) NOT NULL,
    user_id integer,
    unit_code varchar(20),
    ip_address varchar(64),
    user_agent varchar(300),
    result varchar(30) NOT NULL
);
-- Đếm số lần sai mật khẩu của một tên đăng nhập; màn lịch sử lọc theo người, theo thời gian.
CREATE INDEX IF NOT EXISTS ix_sys_login_history_user_name ON sys_login_history (user_name, log_time DESC);
CREATE INDEX IF NOT EXISTS ix_sys_login_history_user_id ON sys_login_history (user_id, log_time DESC);
CREATE INDEX IF NOT EXISTS ix_sys_login_history_log_time ON sys_login_history (log_time DESC);

CREATE TABLE IF NOT EXISTS sys_password_history (
    id bigserial PRIMARY KEY,
    user_id integer NOT NULL,
    password_hash varchar(255) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_sys_password_history_user_id ON sys_password_history (user_id, id DESC);
