import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='OwnerEntity',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('code', models.CharField(db_index=True, max_length=32, unique=True)),
                ('name', models.CharField(max_length=255)),
                ('entity_type', models.CharField(max_length=64)),
                ('status', models.CharField(default='Active', max_length=32)),
                ('tin_encrypted', models.TextField(blank=True)),
                ('vat_reg_encrypted', models.TextField(blank=True)),
                ('address', models.TextField(blank=True)),
                ('contact_phone', models.CharField(blank=True, max_length=32)),
                ('contact_email', models.EmailField(blank=True, max_length=254)),
                ('version', models.PositiveIntegerField(default=1)),
                ('effective_date', models.DateField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='PartyIdentity',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('code', models.CharField(max_length=48)),
                ('legal_name', models.CharField(max_length=255)),
                ('party_kind', models.CharField(choices=[('Registered Title-Holder', 'Registered Title-Holder'), ('Pending Trading Identity', 'Pending Trading Identity')], max_length=48)),
                ('confirmation_status', models.CharField(choices=[('Confirmed Title-Holder', 'Confirmed Title-Holder'), ('Pending Documentary Confirmation', 'Pending Documentary Confirmation')], default='Pending Documentary Confirmation', max_length=48)),
                ('inter_entity_posting_enabled', models.BooleanField(default=False)),
                ('tin_encrypted', models.TextField(blank=True)),
                ('evidence_ref', models.CharField(blank=True, max_length=128)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='party_identities', to='portfolio.ownerentity')),
            ],
            options={
                'unique_together': {('owner', 'code')},
            },
        ),
        migrations.CreateModel(
            name='Property',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('code', models.CharField(max_length=32)),
                ('name', models.CharField(max_length=255)),
                ('sub_city', models.CharField(max_length=120)),
                ('woreda', models.CharField(max_length=64)),
                ('street', models.CharField(blank=True, max_length=255)),
                ('landmark', models.CharField(blank=True, max_length=255)),
                ('property_type', models.CharField(max_length=64)),
                ('status', models.CharField(default='Active', max_length=32)),
                ('effective_date', models.DateField()),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='properties', to='portfolio.ownerentity')),
            ],
            options={
                'unique_together': {('owner', 'code')},
            },
        ),
        migrations.CreateModel(
            name='Building',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('code', models.CharField(max_length=32)),
                ('name', models.CharField(max_length=255)),
                ('floors', models.PositiveSmallIntegerField(default=1)),
                ('total_units_expected', models.PositiveIntegerField(default=20)),
                ('unit_count_status', models.CharField(choices=[('Verified', 'Verified Deed / Floorplan'), ('Provisional', 'Provisional (~20 Estimated)')], default='Provisional', max_length=24)),
                ('deed_reference', models.CharField(blank=True, max_length=128)),
                ('address_note', models.CharField(blank=True, max_length=255)),
                ('status', models.CharField(default='Active', max_length=32)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='buildings', to='portfolio.ownerentity')),
                ('property_ref', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='buildings', to='portfolio.property')),
            ],
            options={
                'unique_together': {('owner', 'code')},
            },
        ),
        migrations.CreateModel(
            name='TenantProfile',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('code', models.CharField(max_length=32)),
                ('name', models.CharField(max_length=255)),
                ('business_type', models.CharField(max_length=120)),
                ('phone_msisdn', models.CharField(db_index=True, max_length=20)),
                ('email', models.EmailField(blank=True, max_length=254)),
                ('emergency_contact', models.CharField(blank=True, max_length=255)),
                ('id_number_encrypted', models.TextField(blank=True)),
                ('status', models.CharField(default='Active', max_length=32)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='tenants', to='portfolio.ownerentity')),
            ],
            options={
                'unique_together': {('owner', 'code')},
            },
        ),
        migrations.CreateModel(
            name='Unit',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('code', models.CharField(max_length=32)),
                ('name', models.CharField(max_length=255)),
                ('floor', models.IntegerField(default=0)),
                ('area_sqm', models.DecimalField(decimal_places=2, max_digits=10)),
                ('unit_type', models.CharField(max_length=64)),
                ('status', models.CharField(default='Vacant', max_length=32)),
                ('base_rent_etb', models.DecimalField(decimal_places=2, max_digits=14)),
                ('previous_identifiers', models.JSONField(default=list)),
                ('building', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='units', to='portfolio.building')),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='units', to='portfolio.ownerentity')),
                ('property_ref', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='units', to='portfolio.property')),
            ],
            options={
                'unique_together': {('building', 'code')},
            },
        ),
        migrations.CreateModel(
            name='Lease',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('lease_number', models.CharField(max_length=64)),
                ('version', models.PositiveIntegerField(default=1)),
                ('status', models.CharField(default='Draft', max_length=32)),
                ('start_date', models.DateField()),
                ('end_date', models.DateField()),
                ('monthly_rent_etb', models.DecimalField(decimal_places=2, max_digits=14)),
                ('security_deposit_etb', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('billing_cycle', models.CharField(default='Monthly', max_length=16)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='leases', to='portfolio.ownerentity')),
                ('supersedes_lease', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='portfolio.lease')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='leases', to='portfolio.tenantprofile')),
                ('unit', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='leases', to='portfolio.unit')),
            ],
            options={
                'unique_together': {('owner', 'lease_number', 'version')},
            },
        ),
    ]
