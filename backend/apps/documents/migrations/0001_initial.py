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
            name='DocumentAsset',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('entity_type', models.CharField(choices=[('CBE_SLIP', 'CBE Bank Slip'), ('LEASE_PDF', 'Signed Lease PDF'), ('REPAIR_PHOTO', 'Maintenance Photo'), ('TENANT_KYC', 'Tenant KYC Document'), ('ERCA_CERT', 'ERCA / Adviser Evidence')], max_length=32)),
                ('entity_ref_id', models.CharField(db_index=True, max_length=128)),
                ('object_key', models.CharField(max_length=512, unique=True)),
                ('original_filename', models.CharField(max_length=255)),
                ('mime_type', models.CharField(max_length=128)),
                ('file_size_bytes', models.PositiveIntegerField()),
                ('sha256_checksum', models.CharField(blank=True, max_length=64)),
                ('retention_class', models.CharField(default='FIN-10Y-ET', max_length=64)),
                ('legal_hold', models.BooleanField(default=False)),
                ('exif_stripped', models.BooleanField(default=False)),
                ('uploaded_by_actor_id', models.CharField(max_length=64)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='documents', to='portfolio.ownerentity')),
            ],
        ),
    ]
