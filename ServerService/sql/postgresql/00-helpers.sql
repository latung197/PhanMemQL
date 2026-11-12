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

-- Shared column types (domains). Every new column of these kinds uses a domain instead of typing the type by hand, so the
-- same kind of value has the same type everywhere. The name carries the definition (ud_code20 = varchar(20)), so it never
-- lies: PostgreSQL cannot change the length of a varchar domain in place, a wider one is a new domain (ud_code64 next to
-- ud_code50) and the columns are moved to it. Columns read as the base type (information_schema, EF Core, Dapper), so no
-- code change is needed.
--   ud_codeN   codes: catalog codes, document numbers
--   ud_textN   free text: names, descriptions, notes
--   ud_decP_S  numeric(P,S): ud_dec18_2 money, ud_dec18_4 quantity / unit price / unit cost, ud_dec9_4 percent / rate,
--              ud_dec20_8 conversion factor
--   ud_status  status of a record or voucher (Draft, Pending, ...); ud_user_id  id of a user (created_by, approved_by_user_id)
--   ud_smallint / ud_int / ud_bigint / ud_bool / ud_date / ud_timestamptz  plain types, named after the type
-- Add one line to the list when a new length is really needed; never type a bare varchar(N) / numeric(P,S) in a new column.
DO $$
DECLARE d record;
BEGIN
    FOR d IN SELECT * FROM (VALUES
        ('ud_code10', 'varchar(10)'), ('ud_code20', 'varchar(20)'), ('ud_code30', 'varchar(30)'),
        ('ud_code50', 'varchar(50)'), ('ud_code64', 'varchar(64)'),
        ('ud_text100', 'varchar(100)'), ('ud_text200', 'varchar(200)'), ('ud_text300', 'varchar(300)'),
        ('ud_text500', 'varchar(500)'), ('ud_text1000', 'varchar(1000)'),
        ('ud_dec18_2', 'numeric(18,2)'), ('ud_dec18_4', 'numeric(18,4)'),
        ('ud_dec9_4', 'numeric(9,4)'), ('ud_dec20_8', 'numeric(20,8)'),
        ('ud_status', 'varchar(20)'), ('ud_user_id', 'integer'),
        ('ud_smallint', 'smallint'), ('ud_int', 'integer'), ('ud_bigint', 'bigint'),
        ('ud_bool', 'boolean'), ('ud_date', 'date'), ('ud_timestamptz', 'timestamptz')
    ) AS v(name, base)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                       WHERE t.typname = d.name AND n.nspname = current_schema()) THEN
            EXECUTE format('CREATE DOMAIN %I AS %s', d.name, d.base);
        END IF;
    END LOOP;
END $$;
