from decimal import Decimal
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
            name='MaintenanceTicket',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('ticket_number', models.CharField(max_length=48, unique=True)),
                ('category', models.CharField(default='Maintenance', max_length=24)),
                ('priority', models.CharField(default='Medium', max_length=16)),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField()),
                ('estimated_cost_etb', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14)),
                ('work_order_state', models.CharField(default='Logged', max_length=32)),
                ('photo_object_key', models.CharField(blank=True, max_length=512)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='maintenance_tickets', to='portfolio.ownerentity')),
                ('tenant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='maintenance_tickets', to='portfolio.tenantprofile')),
                ('unit', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='maintenance_tickets', to='portfolio.unit')),
            ],
        ),
        migrations.CreateModel(
            name='MaintenanceMessage',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('sender_actor_id', models.CharField(max_length=64)),
                ('sender_name', models.CharField(max_length=120)),
                ('sender_role', models.CharField(max_length=24)),
                ('visibility', models.CharField(choices=[('Shared with Tenant', 'Shared with Tenant'), ('Internal Staff Note', 'Internal Staff Note')], default='Shared with Tenant', max_length=32)),
                ('body', models.TextField()),
                ('attachment_key', models.CharField(blank=True, max_length=512)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='portfolio.ownerentity')),
                ('ticket', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='messages', to='maintenance.maintenanceticket')),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
    ]
