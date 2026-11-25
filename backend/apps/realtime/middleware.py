from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from apps.accounts.models import UserAccount


@database_sync_to_async
def _resolve_user(token_str: str):
    try:
        token = AccessToken(token_str)
        return UserAccount.objects.get(id=token['user_id'], is_active=True)
    except Exception:
        return AnonymousUser()


class JwtWebSocketAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        headers = dict(scope.get('headers') or [])
        token_str = ''

        auth_header = headers.get(b'authorization', b'').decode('utf-8', errors='ignore').strip()
        if auth_header.lower().startswith('bearer '):
            token_str = auth_header[7:].strip()

        if not token_str:
            proto_header = headers.get(b'sec-websocket-protocol', b'').decode('utf-8', errors='ignore')
            for part in proto_header.split(','):
                candidate = part.strip()
                if candidate.startswith('bearer.'):
                    token_str = candidate[7:].strip()
                    break

        if not token_str:
            query_params = parse_qs(scope.get('query_string', b'').decode('utf-8'))
            token_list = query_params.get('token') or []
            token_str = token_list[0] if token_list else ''

        scope['user'] = await _resolve_user(token_str) if token_str else AnonymousUser()
        return await super().__call__(scope, receive, send)
