import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.prod')
django_asgi_app = get_asgi_application()

from apps.realtime.middleware import JwtWebSocketAuthMiddleware  # noqa: E402
from apps.realtime.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': JwtWebSocketAuthMiddleware(URLRouter(websocket_urlpatterns)),
})
