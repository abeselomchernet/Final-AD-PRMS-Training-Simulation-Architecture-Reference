from decimal import Decimal
import uuid
from django.db import models
from apps.portfolio.models import OwnerEntity, TenantProfile, Unit


class MaintenanceTicket(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='maintenance_tickets')
    ticket_number = models.CharField(max_length=48, unique=True)
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name='maintenance_tickets')
    tenant = models.ForeignKey(TenantProfile, null=True, blank=True, on_delete=models.SET_NULL, related_name='maintenance_tickets')
    category = models.CharField(max_length=24, default='Maintenance')
    priority = models.CharField(max_length=16, default='Medium')
    title = models.CharField(max_length=255)
    description = models.TextField()
    estimated_cost_etb = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    work_order_state = models.CharField(max_length=32, default='Logged')
    photo_object_key = models.CharField(max_length=512, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class MaintenanceMessage(models.Model):
    class Visibility(models.TextChoices):
        SHARED_WITH_TENANT = 'Shared with Tenant', 'Shared with Tenant'
        INTERNAL_STAFF_NOTE = 'Internal Staff Note', 'Internal Staff Note'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT)
    ticket = models.ForeignKey(MaintenanceTicket, on_delete=models.CASCADE, related_name='messages')
    sender_actor_id = models.CharField(max_length=64)
    sender_name = models.CharField(max_length=120)
    sender_role = models.CharField(max_length=24)  # Tenant | Staff | Owner
    visibility = models.CharField(max_length=32, choices=Visibility.choices, default=Visibility.SHARED_WITH_TENANT)
    body = models.TextField()
    attachment_key = models.CharField(max_length=512, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
