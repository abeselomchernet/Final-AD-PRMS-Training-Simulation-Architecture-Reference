from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ledger', '0003_deposit_subledger_and_tax_packs'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='leaseaccountingschedule',
            index=models.Index(
                fields=['owner', 'lease', 'period'],
                name='ledger_sched_own_lse_per_idx',
            ),
        ),
    ]
