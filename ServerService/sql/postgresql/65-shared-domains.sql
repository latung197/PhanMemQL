-- Moves the columns of every erp_* / sys_* table onto the shared domains of 00-helpers.sql (ud_code20, ud_text200,
-- ud_dec18_2, ud_status, ud_user_id ...), so the same kind of value has the same type everywhere. Safe to rerun: a column that
-- already has a domain is left alone, so the script does nothing the second time. Scripts that create tables write the domains
-- themselves and need no conversion; a table created with a bare varchar(N) is picked up by the next run of this script.
--
-- Rules (by column name and type, nothing else is touched):
--   varchar  status (20)                         -> ud_status
--            code / *_code (10, 20, 30, 50, 64)  -> ud_code<N>
--            other names (100, 200, 300, 500, 1000) -> ud_text<N>
--   numeric  (18,2) (18,4) (9,4) (20,8)          -> ud_dec<P>_<S>
--   integer  created_by, updated_by, user_id, *_user_id -> ud_user_id
-- Plain types (integer, boolean, date, timestamptz) are NOT converted: ud_int / ud_bool / ud_date / ud_timestamptz are for
-- new columns only. Identity / serial columns, generated columns and columns a view reads are skipped (listed in a NOTICE).
--
-- Lengths are first unified to their source, which the code already enforces: material_code 50 (erp_material.code),
-- *uom_code 20 (erp_uom.code), lot_number 30 (erp_lot.lot_no). A column that holds longer data stops the script.
DO $$
DECLARE
    r record;
    target text;
    n int;
    longest int;
    changed int := 0;
    skipped text := '';
BEGIN
    FOR r IN
        SELECT c.table_name, c.column_name, c.data_type,
               c.character_maximum_length AS len, c.numeric_precision AS prec, c.numeric_scale AS scale
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
        WHERE c.table_schema = current_schema()
          AND c.table_name ~ '^(erp|sys)_'
          AND c.domain_name IS NULL
          AND c.is_identity = 'NO'
          AND c.is_generated = 'NEVER'
          AND coalesce(c.column_default, '') NOT LIKE 'nextval%'
        ORDER BY c.table_name, c.ordinal_position
    LOOP
        target := NULL;
        n := r.len;

        IF r.data_type = 'character varying' THEN
            IF r.column_name = 'material_code' THEN n := 50;
            ELSIF r.column_name ~ '(^|_)uom_code$' THEN n := 20;
            ELSIF r.column_name = 'lot_number' THEN n := 30;
            END IF;

            IF r.column_name = 'status' AND n = 20 THEN
                target := 'ud_status';
            ELSIF (r.column_name = 'code' OR r.column_name LIKE '%\_code') AND n IN (10, 20, 30, 50, 64) THEN
                target := 'ud_code' || n;
            ELSIF r.column_name = 'lot_number' AND n = 30 THEN
                target := 'ud_code30';
            ELSIF r.column_name NOT LIKE '%code' AND n IN (100, 200, 300, 500, 1000) THEN
                target := 'ud_text' || n;
            END IF;
        ELSIF r.data_type = 'numeric' THEN
            IF (r.prec, r.scale) IN ((18, 2), (18, 4), (9, 4), (20, 8)) THEN
                target := 'ud_dec' || r.prec || '_' || r.scale;
            END IF;
        ELSIF r.data_type = 'integer' THEN
            IF r.column_name IN ('created_by', 'updated_by', 'user_id') OR r.column_name ~ '(^|_)user_id$' THEN
                target := 'ud_user_id';
            END IF;
        END IF;

        CONTINUE WHEN target IS NULL;

        -- A view that reads the column blocks ALTER COLUMN TYPE: leave it, say so.
        IF EXISTS (SELECT 1
                   FROM pg_depend d
                   JOIN pg_rewrite w ON w.oid = d.objid
                   JOIN pg_class v ON v.oid = w.ev_class AND v.relkind IN ('v', 'm')
                   JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
                   WHERE d.classid = 'pg_rewrite'::regclass
                     AND d.refobjid = format('%I.%I', current_schema(), r.table_name)::regclass
                     AND a.attname = r.column_name) THEN
            skipped := skipped || ' ' || r.table_name || '.' || r.column_name;
            CONTINUE;
        END IF;

        IF r.data_type = 'character varying' AND n < r.len THEN
            EXECUTE format('SELECT coalesce(max(length(%I)), 0) FROM %I', r.column_name, r.table_name) INTO longest;
            IF longest > n THEN
                RAISE EXCEPTION '%.% holds a value of % characters, longer than the % of its source', r.table_name, r.column_name, longest, n;
            END IF;
        END IF;

        EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE %I', r.table_name, r.column_name, target);
        changed := changed + 1;
    END LOOP;

    RAISE NOTICE '65-shared-domains: % columns moved to a domain%', changed,
        CASE WHEN skipped = '' THEN '' ELSE '; skipped (a view reads them):' || skipped END;
END $$;
