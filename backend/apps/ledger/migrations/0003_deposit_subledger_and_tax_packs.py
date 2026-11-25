from decimal import Decimal
import uuid
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


def apply_deposit_movement_postgres(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("""
            CREATE OR REPLACE FUNCTION prevent_deposit_movement_mutation()
            RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'DepositMovement subledger is append-only and cannot be updated or deleted.';
            END;
            $$ LANGUAGE plpgsql;

            DO $$
            BEGIN
                IF to_regclass('ledger_depositmovement') IS NOT NULL THEN
                    DROP TRIGGER IF EXISTS trg_prevent_deposit_movement_mutation ON ledger_depositmovement;
                    CREATE TRIGGER trg_prevent_deposit_movement_mutation
                        BEFORE UPDATE OR DELETE ON ledger_depositmovement
                        FOR EACH ROW EXECUTE FUNCTION prevent_deposit_movement_mutation();

                    ALTER TABLE ledger_depositmovement ENABLE ROW LEVEL SECURITY;
                    ALTER TABLE ledger_depositmovement FORCE ROW LEVEL SECURITY;
                    DROP POLICY IF EXISTS adprms_owner_isolation ON ledger_depositmovement;
                    CREATE POLICY adprms_owner_isolation ON ledger_depositmovement
                        USING (owner_id = NULLIF(current_setting('app.current_owner_id', true), '')::uuid)
                        WITH CHECK (owner_id = NULLIF(current_setting('app.current_owner_id', true), '')::uuid);
                END IF;
            END $$;
        """)


def reverse_deposit_movement_postgres(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("""
            DO $$
            BEGIN
                IF to_regclass('ledger_depositmovement') IS NOT NULL THEN
                    DROP POLICY IF EXISTS adprms_owner_isolation ON ledger_depositmovement;
                    ALTER TABLE ledger_depositmovement NO FORCE ROW LEVEL SECURITY;
                    ALTER TABLE ledger_depositmovement DISABLE ROW LEVEL SECURITY;
                    DROP TRIGGER IF EXISTS trg_prevent_deposit_movement_mutation ON ledger_depositmovement;
                END IF;
                DROP FUNCTION IF EXISTS prevent_deposit_movement_mutation();
            END $$;
        """)


class Migration(migrations.Migration):
    dependencies = [
        ('ledger', '0002_pg_ledger_triggers_and_rls'),
        ('portfolio', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='ledger',
            name='entity_type',
            field=models.CharField(
                choices=[
                    ('Undetermined', 'Undetermined (Pending Documentary Confirmation)'),
                    ('SoleProprietor', 'Individual / Sole Proprietor'),
                    ('PLC', 'PLC / Share Company'),
                ],
                default='Undetermined',
                max_length=24,
            ),
        ),
        migrations.AddField(
            model_name='ledger',
            name='enforce_daily_cash_cap',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='ledger',
            name='daily_cash_cap_etb',
            field=models.DecimalField(decimal_places=2, default=Decimal('50000.00'), max_digits=14),
        ),
        migrations.AddField(
            model_name='journalentry',
            name='approval_payload_hash',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name='journalentry',
            name='approval_request_id',
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name='taxrulepack',
            name='approval_history_json',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='taxrulepack',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='taxrulepack',
            name='reviewer_license_ref',
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name='taxrulepack',
            name='reviewer_name',
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name='taxrulepack',
            name='version',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='taxworkpaper',
            name='entity_type_evaluated',
            field=models.CharField(default='Undetermined', max_length=24),
        ),
        migrations.AddField(
            model_name='taxworkpaper',
            name='evaluation_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='taxworkpaper',
            name='rule_pack_version',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.CreateModel(
            name='DepositMovement',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('movement_type', models.CharField(choices=[('Receipt', 'Receipt'), ('Refund', 'Refund'), ('Deduction', 'Deduction'), ('LeaseTransfer', 'Lease Transfer'), ('OpeningBalance', 'Opening Balance')], max_length=24)),
                ('signed_amount_etb', models.DecimalField(decimal_places=2, max_digits=14)),
                ('effective_date', models.DateField()),
                ('reference', models.CharField(max_length=128)),
                ('maker_actor_id', models.CharField(max_length=64)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('lease', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='deposit_movements', to='portfolio.lease')),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='deposit_movements', to='portfolio.ownerentity')),
                ('posted_journal', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='deposit_movements', to='ledger.journalentry')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='deposit_movements', to='portfolio.tenantprofile')),
            ],
            options={
                'indexes': [models.Index(fields=['owner', 'tenant', 'effective_date'], name='ledger_dep_own_ten_dt_idx')],
            },
        ),
        migrations.RunPython(apply_deposit_movement_postgres, reverse_code=reverse_deposit_movement_postgres),
    ]
