from django.db import migrations


def apply_portfolio_pg_triggers(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("""
            CREATE OR REPLACE FUNCTION enforce_portfolio_cross_owner()
            RETURNS trigger AS $$
            DECLARE
                prop_owner uuid;
                bldg_owner uuid;
                unit_owner uuid;
                ten_owner uuid;
            BEGIN
                IF TG_TABLE_NAME = 'portfolio_building' THEN
                    SELECT owner_id INTO prop_owner FROM portfolio_property WHERE id = NEW.property_ref_id;
                    IF prop_owner IS DISTINCT FROM NEW.owner_id THEN
                        RAISE EXCEPTION 'Cross-owner invariant violation: Building.owner must match Property.owner';
                    END IF;
                ELSIF TG_TABLE_NAME = 'portfolio_unit' THEN
                    SELECT owner_id INTO prop_owner FROM portfolio_property WHERE id = NEW.property_ref_id;
                    SELECT owner_id INTO bldg_owner FROM portfolio_building WHERE id = NEW.building_id;
                    IF prop_owner IS DISTINCT FROM NEW.owner_id OR bldg_owner IS DISTINCT FROM NEW.owner_id THEN
                        RAISE EXCEPTION 'Cross-owner invariant violation: Unit.owner must match Property and Building';
                    END IF;
                ELSIF TG_TABLE_NAME = 'portfolio_lease' THEN
                    SELECT owner_id INTO unit_owner FROM portfolio_unit WHERE id = NEW.unit_id;
                    SELECT owner_id INTO ten_owner FROM portfolio_tenantprofile WHERE id = NEW.tenant_id;
                    IF unit_owner IS DISTINCT FROM NEW.owner_id OR ten_owner IS DISTINCT FROM NEW.owner_id THEN
                        RAISE EXCEPTION 'Cross-owner invariant violation: Lease.owner must match Unit and Tenant';
                    END IF;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DROP TRIGGER IF EXISTS trg_portfolio_building_owner ON portfolio_building;
            CREATE TRIGGER trg_portfolio_building_owner
                BEFORE INSERT OR UPDATE ON portfolio_building
                FOR EACH ROW EXECUTE FUNCTION enforce_portfolio_cross_owner();

            DROP TRIGGER IF EXISTS trg_portfolio_unit_owner ON portfolio_unit;
            CREATE TRIGGER trg_portfolio_unit_owner
                BEFORE INSERT OR UPDATE ON portfolio_unit
                FOR EACH ROW EXECUTE FUNCTION enforce_portfolio_cross_owner();

            DROP TRIGGER IF EXISTS trg_portfolio_lease_owner ON portfolio_lease;
            CREATE TRIGGER trg_portfolio_lease_owner
                BEFORE INSERT OR UPDATE ON portfolio_lease
                FOR EACH ROW EXECUTE FUNCTION enforce_portfolio_cross_owner();
        """)


def reverse_portfolio_pg_triggers(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("""
            DROP TRIGGER IF EXISTS trg_portfolio_building_owner ON portfolio_building;
            DROP TRIGGER IF EXISTS trg_portfolio_unit_owner ON portfolio_unit;
            DROP TRIGGER IF EXISTS trg_portfolio_lease_owner ON portfolio_lease;
            DROP FUNCTION IF EXISTS enforce_portfolio_cross_owner();
        """)


class Migration(migrations.Migration):
    dependencies = [
        ('portfolio', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(apply_portfolio_pg_triggers, reverse_code=reverse_portfolio_pg_triggers),
    ]
