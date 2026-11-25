import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ('billing', '0001_initial'),
        ('portfolio', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='GatewayTransaction',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('provider', models.CharField(choices=[('ArifPay Checkout', 'ArifPay Checkout'), ('Telebirr Merchant', 'Telebirr Merchant'), ('CBE Transfer Slip', 'CBE Transfer Slip')], max_length=32)),
                ('amount_etb', models.DecimalField(decimal_places=2, max_digits=14)),
                ('idempotency_nonce', models.CharField(max_length=128, unique=True)),
                ('external_session_id', models.CharField(blank=True, db_index=True, max_length=128)),
                ('external_reference', models.CharField(blank=True, max_length=128)),
                ('phone_or_account', models.CharField(blank=True, max_length=64)),
                ('slip_document_key', models.CharField(blank=True, max_length=512)),
                ('status', models.CharField(choices=[('Pending Verification', 'Pending Verification'), ('Verified', 'Verified'), ('Rejected', 'Rejected')], default='Pending Verification', max_length=24)),
                ('signature_verified', models.BooleanField(default=False)),
                ('raw_webhook_payload', models.JSONField(blank=True, null=True)),
                ('verified_by_actor_id', models.CharField(blank=True, max_length=64)),
                ('verified_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('charge', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='gateway_transactions', to='billing.charge')),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='gateway_transactions', to='portfolio.ownerentity')),
                ('receipt', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='billing.paymentreceipt')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='gateway_transactions', to='portfolio.tenantprofile')),
                ('unit', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='portfolio.unit')),
            ],
        ),
    ]
