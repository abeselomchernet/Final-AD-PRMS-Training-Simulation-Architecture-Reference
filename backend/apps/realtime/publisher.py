import uuid
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone


def broadcast_owner_event(*, owner_code: str, event_type: str, data: dict, tenant_id: str | None = None) -> None:
    layer = get_channel_layer()
    if not layer:
        return
    payload = {
        'eventId': f'EVT-{uuid.uuid4().hex[:12]}',
        'type': event_type,
        'ownerId': owner_code,
        'timestamp': timezone.now().isoformat(),
        'data': data,
    }
    async_to_sync(layer.group_send)(f'owner_{owner_code}', {'type': 'sync.event', 'payload': payload})
    if tenant_id:
        async_to_sync(layer.group_send)(f'tenant_{tenant_id}', {'type': 'sync.event', 'payload': payload})
