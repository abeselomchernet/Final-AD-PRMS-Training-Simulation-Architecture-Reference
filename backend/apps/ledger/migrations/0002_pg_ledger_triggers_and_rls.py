from django.db import migrations


LEDGER_OWNER_SCOPED_TABLES = [
    'ledger_ledger',
    'ledger_ledgeraccount',
    'ledger_accountingperiod',
    'ledger_journalentry',
    'ledger_journalline',
    'ledger_leaseaccountingschedule',
    'ledger_gatewaysettlementbatch',
    'ledger_reconciliationrun',
    'ledger_closechecklistitem',
    'ledger_fixedassetitem',
    'ledger_taxworkpaper',
]


def apply_ledger_postgres(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return

    with schema_editor.connection.cursor() as cursor:
        # 1. Append-only immutability on journal_lines and journal_entries
        cursor.execute("""
            CREATE OR REPLACE FUNCTION prevent_ledger_line_mutation()
            RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'Ledger immutability violation: journal_lines are append-only (use PR-25 reversal).';
            END;
            $$ LANGUAGE plpgsql;

            CREATE OR REPLACE FUNCTION protect_journal_entry_core()
            RETURNS trigger AS $$
            BEGIN
                IF TG_OP = 'DELETE' THEN
                    RAISE EXCEPTION 'Ledger immutability violation: journal_entries cannot be deleted.';
                END IF;
                IF NEW.journal_number <> OLD.journal_number
                   OR NEW.entry_date <> OLD.entry_date
                   OR NEW.period_id <> OLD.period_id
                   OR NEW.rule_id <> OLD.rule_id
                   OR NEW.idempotency_key <> OLD.idempotency_key THEN
                    RAISE EXCEPTION 'Ledger immutability violation: core fields on journal_entries cannot be modified.';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DO $$
            BEGIN
                IF to_regclass('ledger_journalline') IS NOT NULL THEN
                    DROP TRIGGER IF EXISTS trg_prevent_ledger_line_mutation ON ledger_journalline;
                    CREATE TRIGGER trg_prevent_ledger_line_mutation
                        BEFORE UPDATE OR DELETE ON ledger_journalline
                        FOR EACH ROW EXECUTE FUNCTION prevent_ledger_line_mutation();
                END IF;

                IF to_regclass('ledger_journalentry') IS NOT NULL THEN
                    DROP TRIGGER IF EXISTS trg_protect_journal_entry_core ON ledger_journalentry;
                    CREATE TRIGGER trg_protect_journal_entry_core
                        BEFORE UPDATE OR DELETE ON ledger_journalentry
                        FOR EACH ROW EXECUTE FUNCTION protect_journal_entry_core();
                END IF;
            END $$;
        """)

        # 2. Enforce Row-Level Security across all ledger owner-scoped tables
        for table in LEDGER_OWNER_SCOPED_TABLES:
            cursor.execute(f"""
                DO $$
                BEGIN
                    IF to_regclass('public.{table}') IS NOT NULL THEN
                        ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;
                        ALTER TABLE public.{table} FORCE ROW LEVEL SECURITY;
                        DROP POLICY IF EXISTS adprms_owner_isolation ON public.{table};
                        CREATE POLICY adprms_owner_isolation ON public.{table}
                            USING (owner_id = NULLIF(current_setting('app.current_owner_id', true), '')::uuid)
                            WITH CHECK (owner_id = NULLIF(current_setting('app.current_owner_id', true), '')::uuid);
                    END IF;
                END $$;
            """)


def reverse_ledger_postgres(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return

    with schema_editor.connection.cursor() as cursor:
        for table in LEDGER_OWNER_SCOPED_TABLES:
            cursor.execute(f"""
                DO $$
                BEGIN
                    IF to_regclass('{table}') IS NOT NULL THEN
                        DROP POLICY IF EXISTS adprms_owner_isolation ON {table};
                        ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;
                        ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;
                    END IF;
                END $$;
            """)
        cursor.execute("""
            DO $$
            BEGIN
                IF to_regclass('ledger_journalline') IS NOT NULL THEN
                    DROP TRIGGER IF EXISTS trg_prevent_ledger_line_mutation ON ledger_journalline;
                END IF;
                IF to_regclass('ledger_journalentry') IS NOT NULL THEN
                    DROP TRIGGER IF EXISTS trg_protect_journal_entry_core ON ledger_journalentry;
                END IF;
                DROP FUNCTION IF EXISTS prevent_ledger_line_mutation();
                DROP FUNCTION IF EXISTS protect_journal_entry_core();
            END $$;
        """)


class Migration(migrations.Migration):
    dependencies = [
        ('ledger', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(apply_ledger_postgres, reverse_code=reverse_ledger_postgres),
    ]
