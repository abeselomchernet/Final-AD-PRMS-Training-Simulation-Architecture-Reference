from django.db import migrations


OWNER_SCOPED_TABLES = [
    'portfolio_partyidentity',
    'portfolio_property',
    'portfolio_building',
    'portfolio_unit',
    'portfolio_tenantprofile',
    'portfolio_lease',
    'billing_charge',
    'billing_paymentreceipt',
    'gateways_gatewaytransaction',
    'documents_documentasset',
    'maintenance_maintenanceticket',
    'maintenance_maintenancemessage',
    'governance_approvalrequest',
    'governance_taxrule',
    'governance_ercaverificationgate',
    'governance_auditevent',
]


def apply_wp2_postgres(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return

    with schema_editor.connection.cursor() as cursor:
        # 1. Attach audit immutability triggers & privilege revocation on governance_auditevent
        cursor.execute("""
            DO $$
            BEGIN
                IF to_regclass('governance_auditevent') IS NOT NULL THEN
                    DROP TRIGGER IF EXISTS trg_prevent_audit_row_mutation ON governance_auditevent;
                    CREATE TRIGGER trg_prevent_audit_row_mutation
                        BEFORE UPDATE OR DELETE ON governance_auditevent
                        FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

                    DROP TRIGGER IF EXISTS trg_prevent_audit_truncate ON governance_auditevent;
                    CREATE TRIGGER trg_prevent_audit_truncate
                        BEFORE TRUNCATE ON governance_auditevent
                        FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();

                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'adprms_app') THEN
                        REVOKE UPDATE, DELETE, TRUNCATE ON TABLE governance_auditevent FROM adprms_app;
                    END IF;
                END IF;
            END $$;
        """)

        # 2. Enforce Maker-Checker Segregation of Duties at database trigger level (ADD-SEC-003)
        cursor.execute("""
            CREATE OR REPLACE FUNCTION prevent_self_approval()
            RETURNS trigger AS $$
            DECLARE
                last_entry jsonb;
                checker_actor text;
            BEGIN
                IF NEW.status IN ('Approved', 'Rejected', 'Returned') THEN
                    IF NEW.status = 'Approved' AND (
                        NEW.approved_checker_actor_id IS NULL
                        OR NEW.approved_checker_actor_id = ''
                        OR NEW.approved_checker_actor_id = NEW.maker_actor_id
                    ) THEN
                        RAISE EXCEPTION 'Maker-Checker SoD violation: approved_checker_actor_id "%" cannot finalize request %',
                            COALESCE(NEW.approved_checker_actor_id, ''), NEW.request_number;
                    END IF;
                    IF jsonb_typeof(NEW.decision_log::jsonb) = 'array'
                       AND jsonb_array_length(NEW.decision_log::jsonb) > 0 THEN
                        last_entry := (NEW.decision_log::jsonb) -> (jsonb_array_length(NEW.decision_log::jsonb) - 1);
                        checker_actor := COALESCE(last_entry ->> 'actor_id', '');
                        IF checker_actor = '' OR checker_actor = NEW.maker_actor_id THEN
                            RAISE EXCEPTION 'Maker-Checker SoD violation: actor % cannot finalize their own request %',
                                checker_actor, NEW.request_number;
                        END IF;
                    ELSIF NEW.finalized = TRUE THEN
                        RAISE EXCEPTION 'Maker-Checker SoD violation: finalized approval % requires non-empty decision_log',
                            NEW.request_number;
                    END IF;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DO $$
            BEGIN
                IF to_regclass('governance_approvalrequest') IS NOT NULL THEN
                    DROP TRIGGER IF EXISTS trg_prevent_self_approval ON governance_approvalrequest;
                    CREATE TRIGGER trg_prevent_self_approval
                        BEFORE INSERT OR UPDATE ON governance_approvalrequest
                        FOR EACH ROW EXECUTE FUNCTION prevent_self_approval();
                END IF;
            END $$;
        """)

        # 3. Enable + FORCE Row-Level Security across all owner-scoped tables (ADD-TC-002 / WP-2)
        for table in OWNER_SCOPED_TABLES:
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


def reverse_wp2_postgres(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return

    with schema_editor.connection.cursor() as cursor:
        for table in OWNER_SCOPED_TABLES:
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
                IF to_regclass('governance_approvalrequest') IS NOT NULL THEN
                    DROP TRIGGER IF EXISTS trg_prevent_self_approval ON governance_approvalrequest;
                END IF;
                DROP FUNCTION IF EXISTS prevent_self_approval();

                IF to_regclass('governance_auditevent') IS NOT NULL THEN
                    DROP TRIGGER IF EXISTS trg_prevent_audit_row_mutation ON governance_auditevent;
                    DROP TRIGGER IF EXISTS trg_prevent_audit_truncate ON governance_auditevent;
                END IF;
            END $$;
        """)


class Migration(migrations.Migration):
    dependencies = [
        ('governance', '0002_audit_immutability'),
        ('portfolio', '0002_cross_owner_triggers'),
        ('billing', '0001_initial'),
        ('gateways', '0001_initial'),
        ('documents', '0001_initial'),
        ('maintenance', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(apply_wp2_postgres, reverse_code=reverse_wp2_postgres),
    ]
