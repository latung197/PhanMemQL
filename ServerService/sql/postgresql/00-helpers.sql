-- Helpers used by the other scripts. Run first. Safe to rerun.
--
-- Naming convention:
--   sys_*  system tables (accounts, permissions, company units, notifications, settings)
--   erp_*  business data tables (materials, vouchers, stock and general ledgers, ...)
--   columns in snake_case, no foreign keys (tables are linked by their id/code columns).

-- Renames a table when the old name exists and the new one does not.
CREATE OR REPLACE FUNCTION sys_rename_table(old_name text, new_name text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF to_regclass(old_name) IS NOT NULL AND to_regclass(new_name) IS NULL THEN
        EXECUTE format('ALTER TABLE %I RENAME TO %I', old_name, new_name);
    END IF;
END $$;

-- Renames a column when the old column exists and the new one does not.
CREATE OR REPLACE FUNCTION sys_rename_column(table_name text, old_name text, new_name text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns c
               WHERE c.table_schema = current_schema() AND c.table_name = $1 AND c.column_name = old_name)
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns c
               WHERE c.table_schema = current_schema() AND c.table_name = $1 AND c.column_name = new_name) THEN
        EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', table_name, old_name, new_name);
    END IF;
END $$;

-- Renames an index or a constraint (primary key, unique) when the old name exists.
CREATE OR REPLACE FUNCTION sys_rename_constraint(table_name text, old_name text, new_name text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = old_name AND conrelid = to_regclass(table_name)) THEN
        EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', table_name, old_name, new_name);
    ELSIF to_regclass(old_name) IS NOT NULL AND to_regclass(new_name) IS NULL THEN
        EXECUTE format('ALTER INDEX %I RENAME TO %I', old_name, new_name);
    END IF;
END $$;

-- Drops every foreign key of the given tables (the design uses link columns only).
CREATE OR REPLACE FUNCTION sys_drop_foreign_keys(VARIADIC table_names text[]) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
    FOR r IN SELECT conrelid::regclass AS tbl, conname FROM pg_constraint
             WHERE contype = 'f' AND conrelid::regclass::text = ANY (table_names)
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    END LOOP;
END $$;

-- Accent-insensitive search (Vietnamese users type "thung" for "Thùng"): the unaccent extension, an IMMUTABLE wrapper that
-- indexes can use, and sys_search_match(text, pattern) = unaccent(text) ILIKE unaccent(pattern), which the API calls through
-- SearchFunctions.Matches. Needs the unaccent extension (shipped with PostgreSQL; creating it needs the CREATE privilege).
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION sys_unaccent(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, value) $$;

CREATE OR REPLACE FUNCTION sys_search_match(value text, pattern text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT sys_unaccent(coalesce(value, '')) ILIKE sys_unaccent(coalesce(pattern, '')) $$;
