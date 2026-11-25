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
            name='Charge',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('period', models.CharField(max_length=32)),
                ('invoice_number', models.CharField(max_length=64, unique=True)),
                ('due_date', models.DateField()),
                ('billed_etb', models.DecimalField(decimal_places=2, max_digits=14)),
                ('paid_etb', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14)),
                ('status', models.CharField(choices=[('Open', 'Open'), ('Partially Paid', 'Partially Paid'), ('Overdue', 'Overdue'), ('Paid', 'Paid')], default='Open', max_length=24)),
                ('lease', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='charges', to='portfolio.lease')),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='charges', to='portfolio.ownerentity')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='charges', to='portfolio.tenantprofile')),
                ('unit', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='charges', to='portfolio.unit')),
            ],
            options={
                'indexes': [models.Index(fields=['owner', 'tenant', 'status'], name='bill_chg_own_ten_stat_idx')],
            },
        ),
        migrations.CreateModel(
            name='PaymentReceipt',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('receipt_number', models.CharField(max_length=64, unique=True)),
                ('payment_date', models.DateTimeField()),
                ('amount_etb', models.DecimalField(decimal_places=2, max_digits=14)),
                ('method', models.CharField(max_length=48)),
                ('reference', models.CharField(max_length=128)),
                ('recorded_by_actor_id', models.CharField(max_length=64)),
                ('document_state', models.CharField(default='Issued', max_length=32)),
                ('fiscal_mode', models.CharField(choices=[('PROVISIONAL_NON_FISCAL', 'Provisional — Pending ERCA Tax Verification'), ('FISCAL_ACTIVE', 'Fiscal Receipt (ERCA Verified)')], default='PROVISIONAL_NON_FISCAL', max_length=32)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='receipts', to='portfolio.ownerentity')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='receipts', to='portfolio.tenantprofile')),
                ('unit', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='receipts', to='portfolio.unit')),
            ],
        ),
        migrations.CreateModel(
            name='ReceiptAllocation',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('allocated_etb', models.DecimalField(decimal_places=2, max_digits=14)),
                ('charge', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='allocations', to='billing.charge')),
                ('receipt', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='allocations', to='billing.paymentreceipt')),
            ],
        ),
    ]
