import uuid
import django.contrib.auth.models
import django.contrib.auth.validators
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserAccount',
            fields=[
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('is_superuser', models.BooleanField(default=False, help_text='Designates that this user has all permissions without explicitly assigning them.', verbose_name='superuser status')),
                ('username', models.CharField(error_messages={'unique': 'A user with that username already exists.'}, help_text='Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only.', max_length=150, unique=True, validators=[django.contrib.auth.validators.UnicodeUsernameValidator()], verbose_name='username')),
                ('first_name', models.CharField(blank=True, max_length=150, verbose_name='first name')),
                ('last_name', models.CharField(blank=True, max_length=150, verbose_name='last name')),
                ('email', models.EmailField(blank=True, max_length=254, verbose_name='email address')),
                ('is_staff', models.BooleanField(default=False, help_text='Designates whether the user can log into this admin site.', verbose_name='staff status')),
                ('is_active', models.BooleanField(default=True, help_text='Designates whether this user should be treated as active. Unselect this instead of deleting accounts.', verbose_name='active')),
                ('date_joined', models.DateTimeField(default=django.utils.timezone.now, verbose_name='date joined')),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('user_type', models.CharField(choices=[('STAFF', 'Staff / Owner'), ('TENANT', 'Tenant Self-Service')], default='STAFF', max_length=16)),
                ('actor_id', models.CharField(db_index=True, max_length=64, unique=True)),
                ('role', models.CharField(default='Clerk', max_length=64)),
                ('phone_msisdn', models.CharField(blank=True, db_index=True, max_length=20)),
                ('owner_code', models.CharField(db_index=True, default='OWN-ALPHA', max_length=32)),
                ('allowed_owners', models.JSONField(default=list)),
                ('tenant_id_ref', models.UUIDField(blank=True, db_index=True, null=True)),
                ('mfa_enabled', models.BooleanField(default=False)),
                ('mfa_secret_encrypted', models.TextField(blank=True)),
                ('preferred_locale', models.CharField(default='en', max_length=5)),
                ('groups', models.ManyToManyField(blank=True, help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.', related_name='user_set', related_query_name='user', to='auth.group', verbose_name='groups')),
                ('user_permissions', models.ManyToManyField(blank=True, help_text='Specific permissions for this user.', related_name='user_set', related_query_name='user', to='auth.permission', verbose_name='user permissions')),
            ],
            options={
                'verbose_name': 'user',
                'verbose_name_plural': 'users',
                'abstract': False,
            },
            managers=[
                ('objects', django.contrib.auth.models.UserManager()),
            ],
        ),
        migrations.CreateModel(
            name='OtpChallenge',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('msisdn', models.CharField(db_index=True, max_length=20)),
                ('otp_hash', models.CharField(max_length=128)),
                ('purpose', models.CharField(default='TENANT_LOGIN', max_length=32)),
                ('attempts', models.PositiveSmallIntegerField(default=0)),
                ('max_attempts', models.PositiveSmallIntegerField(default=5)),
                ('expires_at', models.DateTimeField()),
                ('consumed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'indexes': [models.Index(fields=['msisdn', '-created_at'], name='acct_otp_msisdn_created_idx')],
            },
        ),
        migrations.CreateModel(
            name='DelegationRecord',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('owner_code', models.CharField(db_index=True, max_length=32)),
                ('scope_modules', models.JSONField(default=list)),
                ('start_date', models.DateField()),
                ('end_date', models.DateField()),
                ('status', models.CharField(default='Pending Owner Approval', max_length=32)),
                ('owner_approval_ref', models.CharField(blank=True, max_length=64)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('delegate', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='delegations_received', to='accounts.useraccount')),
                ('delegator', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='delegations_granted', to='accounts.useraccount')),
            ],
        ),
    ]
