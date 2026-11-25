from django.urls import path
from .consumers import SyncHubConsumer

websocket_urlpatterns = [
    path('ws/sync/', SyncHubConsumer.as_asgi()),
]
