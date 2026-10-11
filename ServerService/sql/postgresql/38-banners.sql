-- System: banner under the header (a line every signed-in user sees: maintenance, deadlines, incidents). Safe to rerun.
-- GET /api/banners/active returns the active ones of the user's company unit that are inside their time window.
CREATE TABLE IF NOT EXISTS sys_banner (
    code varchar(30) PRIMARY KEY,
    message varchar(500) NOT NULL,
    message_en varchar(500),
    level varchar(8) NOT NULL DEFAULT 'INFO',
    start_at timestamptz,
    end_at timestamptz,
    unit_codes varchar(500) NOT NULL DEFAULT '',
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer,
    CONSTRAINT ck_sys_banner_level CHECK (level IN ('INFO', 'WARNING', 'URGENT')),
    CONSTRAINT ck_sys_banner_time CHECK (start_at IS NULL OR end_at IS NULL OR end_at >= start_at)
);
