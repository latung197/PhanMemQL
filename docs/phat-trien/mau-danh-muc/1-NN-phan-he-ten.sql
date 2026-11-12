-- {{tenVi}} ({{bang}}), chức năng {{ma}}. Sinh bằng "npm run tao-danh-muc" (script NN); không khóa ngoại, chạy lại được.
CREATE TABLE IF NOT EXISTS {{bang}} (
    code ud_code20 PRIMARY KEY,
    name ud_text200 NOT NULL,
    note ud_text300,
    is_active ud_bool NOT NULL DEFAULT true,
    sort_order ud_int NOT NULL DEFAULT 0,
    created_at ud_timestamptz NOT NULL DEFAULT now(),
    created_by ud_user_id,
    updated_at ud_timestamptz,
    updated_by ud_user_id
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_{{bang}}_name ON {{bang}} (lower(name));
