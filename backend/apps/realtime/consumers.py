import json
from channels.generic.websocket import AsyncWebsocketConsumer


class SyncHubConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return

        self.groups_joined = []
        if getattr(user, 'user_type', '') == 'TENANT' and getattr(user, 'tenant_id_ref', None):
            group = f'tenant_{user.tenant_id_ref}'
            await self.channel_layer.group_add(group, self.channel_name)
            self.groups_joined.append(group)
        else:
            for owner_code in getattr(user, 'allowed_owners', []) or [user.owner_code]:
                group = f'owner_{owner_code}'
                await self.channel_layer.group_add(group, self.channel_name)
                self.groups_joined.append(group)

        await self.accept()
        await self.send(text_data=json.dumps({'kind': 'sync:hello', 'groups': self.groups_joined}))

    async def disconnect(self, _close_code):
        for group in getattr(self, 'groups_joined', []):
            await self.channel_layer.group_discard(group, self.channel_name)

    async def sync_event(self, event):
        await self.send(text_data=json.dumps({'kind': 'sync:event', 'event': event['payload']}))
