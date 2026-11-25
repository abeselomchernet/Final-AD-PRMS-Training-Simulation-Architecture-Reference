import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ('portfolio', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ApprovalRequest',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('request_number', models.CharField(max_length=48, unique=True)),
                ('category', models.CharField(max_length=64)),
                ('title', models.CharField(max_length=255)),
                ('target_record_type', models.CharField(max_length=64)),
                ('target_record_id', models.CharField(max_length=128)),
                ('maker_actor_id', models.CharField(max_length=64)),
                ('maker_role', models.CharField(max_length=64)),
                ('workflow_mode', models.CharField(default='Two-Step', max_length=24)),
                ('current_step', models.PositiveSmallIntegerField(default=1)),
                ('total_steps', models.PositiveSmallIntegerField(default=2)),
                ('status', models.CharField(default='Pending', max_length=24)),
                ('finalized', models.BooleanField(default=False)),
                ('before_values', models.JSONField(default=dict)),
                ('after_values', models.JSONField(default=dict)),
                ('payload_json', models.JSONField(blank=True, default=dict)),
                ('payload_hash', models.CharField(blank=True, db_index=True, max_length=64)),
                ('approved_checker_actor_id', models.CharField(blank=True, max_length=64)),
                ('decision_log', models.JSONField(default=list)),
                ('due_date', models.DateField(blank=True, null=True)),
                ('expiry_date', models.DateField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='approval_requests', to='portfolio.ownerentity')),
            ],
        ),
        migrations.CreateModel(
            name='AuditEvent',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('actor_id', models.CharField(max_length=64)),
                ('persona', models.CharField(max_length=64)),
                ('module', models.CharField(max_length=64)),
                ('action', models.CharField(max_length=128)),
                ('record_type', models.CharField(max_length=64)),
                ('record_id', models.CharField(max_length=128)),
                ('reason', models.TextField()),
                ('prev_hash', models.CharField(blank=True, max_length=64)),
                ('event_hash', models.CharField(max_length=64, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='audit_events', to='portfolio.ownerentity')),
            ],
        ),
        migrations.CreateModel(
            name='BackupSnapshotRecord',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('owner_code', models.CharField(db_index=True, default='GLOBAL', max_length=32)),
                ('snapshot_key', models.CharField(max_length=255)),
                ('sha256_checksum', models.CharField(max_length=64)),
                ('documents_checksum', models.CharField(blank=True, max_length=64)),
                ('encryption_key_id', models.CharField(blank=True, max_length=128)),
                ('app_version', models.CharField(blank=True, max_length=64)),
                ('manifest_json', models.JSONField(blank=True, default=dict)),
                ('reconciliation_passed', models.BooleanField(default=False)),
                ('status', models.CharField(default='Verified', max_length=32)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='ErcaVerificationGate',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('erca_tin_verified', models.BooleanField(default=False)),
                ('erca_tin_doc_id', models.CharField(blank=True, max_length=128)),
                ('vat_certificate_verified', models.BooleanField(default=False)),
                ('vat_certificate_doc_id', models.CharField(blank=True, max_length=128)),
                ('adviser_license_ref', models.CharField(blank=True, max_length=128)),
                ('adviser_signed_off', models.BooleanField(default=False)),
                ('owner_activation_approved', models.BooleanField(default=False)),
                ('live_tax_enabled', models.BooleanField(default=False)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('owner', models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name='erca_gate', to='portfolio.ownerentity')),
            ],
        ),
        migrations.CreateModel(
            name='TaxRule',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('code', models.CharField(max_length=64)),
                ('tax_category', models.CharField(max_length=128)),
                ('taxable_status', models.CharField(default='Undetermined', max_length=48)),
                ('rate_percent', models.DecimalField(blank=True, decimal_places=3, max_digits=6, null=True)),
                ('lifecycle_stage', models.CharField(default='Draft', max_length=32)),
                ('source_reference', models.CharField(max_length=255)),
                ('adviser_evidence', models.TextField()),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='tax_rules', to='portfolio.ownerentity')),
            ],
        ),
    ]
