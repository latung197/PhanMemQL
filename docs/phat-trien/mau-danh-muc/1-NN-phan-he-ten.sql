-- {{tenVi}} ({{bang}}), chức năng {{ma}}. Sinh bằng "npm run tao-danh-muc" (script NN); không khóa ngoại, chạy lại được.
CREATE TABLE IF NOT EXISTS {{bang}} (
    code varchar(20) PRIMARY KEY,
    name varchar(200) NOT NULL,
    note varchar(300),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_{{bang}}_name ON {{bang}} (lower(name));
