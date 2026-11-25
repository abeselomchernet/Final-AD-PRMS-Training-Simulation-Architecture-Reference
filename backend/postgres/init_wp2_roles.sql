-- AD-PRMS PostgreSQL 16 WP-2 Role Bootstrap (ADR-003 §4 / WP-2 §2)
-- Run once as a PostgreSQL superuser before running `python manage.py migrate` and `verify_wp2_postgres.py`.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'adprms_admin') THEN
        CREATE ROLE adprms_admin WITH LOGIN PASSWORD 'CHANGE_ME_ADMIN_PASS' SUPERUSER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'adprms_app') THEN
        CREATE ROLE adprms_app WITH LOGIN PASSWORD 'CHANGE_ME_APP_PASS' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    ELSE
        ALTER ROLE adprms_app WITH NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO adprms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO adprms_app;
-- AuditEvent must remain append-only even at privilege level in addition to triggers
DO $$
BEGIN
    IF to_regclass('governance_auditevent') IS NOT NULL THEN
        REVOKE UPDATE, DELETE, TRUNCATE ON TABLE governance_auditevent FROM adprms_app;
    END IF;
END $$;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO adprms_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO adprms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO adprms_app;
