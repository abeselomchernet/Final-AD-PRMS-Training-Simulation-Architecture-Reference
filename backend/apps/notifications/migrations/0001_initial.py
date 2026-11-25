import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SmsDispatchLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('owner_code', models.CharField(db_index=True, max_length=32)),
                ('recipient_msisdn', models.CharField(max_length=20)),
                ('trigger_type', models.CharField(default='General Notice', max_length=48)),
                ('locale', models.CharField(default='en', max_length=5)),
                ('message_body', models.TextField()),
                ('provider', models.CharField(max_length=32)),
                ('provider_message_id', models.CharField(blank=True, max_length=128)),
                ('delivery_state', models.CharField(default='Queued', max_length=32)),
                ('dispatched_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='TenantNotice',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('owner_code', models.CharField(db_index=True, max_length=32)),
                ('tenant_id_ref', models.UUIDField(blank=True, db_index=True, null=True)),
                ('title_en', models.CharField(max_length=255)),
                ('title_am', models.CharField(max_length=255)),
                ('body_en', models.TextField()),
                ('body_am', models.TextField()),
                ('category', models.CharField(default='Building Notice', max_length=48)),
                ('published_by_actor_id', models.CharField(max_length=64)),
                ('published_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='WebPushSubscription',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('owner_code', models.CharField(db_index=True, max_length=32)),
                ('endpoint', models.URLField(max_length=1024, unique=True)),
                ('p256dh', models.CharField(max_length=255)),
                ('auth', models.CharField(max_length=255)),
                ('device_label', models.CharField(blank=True, max_length=120)),
                ('active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('last_sent_at', models.DateTimeField(blank=True, null=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='push_subscriptions', to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
