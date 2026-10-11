-- System: notices shown beside the login form (welcome, maintenance, rules). Safe to rerun.
-- Public read: GET /api/auth/notices returns only active notices inside their date range.
CREATE TABLE IF NOT EXISTS sys_login_notice (
    code varchar(30) PRIMARY KEY,
    title varchar(200) NOT NULL,
    content varchar(2000) NOT NULL DEFAULT '',
    title_en varchar(200),
    content_en varchar(2000),
    kind varchar(12) NOT NULL DEFAULT 'INFO',
    start_date date,
    end_date date,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    CONSTRAINT ck_sys_login_notice_kind CHECK (kind IN ('INFO', 'WELCOME', 'MAINTENANCE', 'RULE')),
    CONSTRAINT ck_sys_login_notice_dates CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
);

INSERT INTO sys_login_notice (code, title, content, title_en, content_en, kind, sort_order)
SELECT v.code, v.title, v.content, v.title_en, v.content_en, v.kind, v.sort_order
FROM (VALUES
    ('CHAOMUNG', 'Chào mừng đến với S-ERP', 'Hệ thống quản trị sản xuất và doanh nghiệp của FSTV Việt Nam.',
        'Welcome to S-ERP', 'The production and business management system of FSTV Vietnam.', 'WELCOME', 1),
    ('QUYTAC-MATKHAU', 'Bảo mật tài khoản', 'Không chia sẻ tài khoản và mật khẩu. Đổi mật khẩu định kỳ trong mục Tài khoản.',
        'Account security', 'Never share your account or password. Change your password regularly under My account.', 'RULE', 2)
) AS v(code, title, content, title_en, content_en, kind, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM sys_login_notice);
