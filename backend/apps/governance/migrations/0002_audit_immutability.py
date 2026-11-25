from django.db import migrations


def apply_audit_function(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("""
            CREATE OR REPLACE FUNCTION prevent_audit_mutation()
            RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'AuditEvent rows are immutable (append-only)';
            END;
            $$ LANGUAGE plpgsql;
        """)


def reverse_audit_function(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute('DROP FUNCTION IF EXISTS prevent_audit_mutation();')


class Migration(migrations.Migration):
    dependencies = [
        ('governance', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(apply_audit_function, reverse_code=reverse_audit_function),
    ]
