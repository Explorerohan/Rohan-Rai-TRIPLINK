"""
ASGI config for TRIPLINK project.

Supports HTTP and WebSocket. WebSocket routes to chat consumer.
"""

import os

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "TRIPLINK.settings")

# Initialize Django ASGI application early so shared models work
django_asgi_app = get_asgi_application()

from accounts.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
