"""
WebSocket consumer for real-time chat.
Supports both session auth (agent web) and JWT token (mobile app).
"""
import json
from django.contrib.auth import get_user_model
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken

User = get_user_model()


def _get_user_from_scope(scope):
    """Get user from scope (set by AuthMiddlewareStack for session auth)."""
    user = scope.get("user")
    if user and user.is_authenticated:
        return user
    return None


def _get_user_from_jwt(token_str):
    """Get user from JWT access token (for mobile app)."""
    if not token_str:
        return None
    try:
        token = AccessToken(token_str)
        user_id = token.get("user_id")
        if not user_id:
            return None
        return User.objects.get(pk=user_id)
    except (InvalidToken, User.DoesNotExist):
        return None


@database_sync_to_async
def get_user_sync(scope, token_str=None):
    """Resolve user from JWT (mobile) or scope/session (agent web)."""
    if token_str:
        return _get_user_from_jwt(token_str)
    return _get_user_from_scope(scope)


@database_sync_to_async
def get_or_create_room(traveler_id, agent_id):
    """Get or create ChatRoom for traveler-agent pair."""
    from .models import ChatRoom, Roles

    traveler = User.objects.filter(pk=traveler_id, role=Roles.TRAVELER).first()
    agent = User.objects.filter(pk=agent_id, role=Roles.AGENT).first()
    if not traveler or not agent:
        return None
    room, _ = ChatRoom.objects.get_or_create(
        traveler=traveler,
        agent=agent,
        defaults={},
    )
    return room


@database_sync_to_async
def user_can_access_room(user, room_id):
    """Check if user (traveler or agent) is participant in the room."""
    from .models import ChatRoom

    try:
        room = ChatRoom.objects.get(pk=room_id)
        return user in (room.traveler, room.agent)
    except ChatRoom.DoesNotExist:
        return False


@database_sync_to_async
def save_message(room_id, sender, text):
    """Save message to DB and return it."""
    from .models import ChatRoom, ChatMessage

    try:
        room = ChatRoom.objects.get(pk=room_id)
    except ChatRoom.DoesNotExist:
        return None
    msg = ChatMessage.objects.create(room=room, sender=sender, text=text)
    room.updated_at = msg.created_at
    room.save(update_fields=["updated_at"])
    return msg


@database_sync_to_async
def get_user_display(user):
    """Get display name for user."""
    try:
        if user.role == "traveler" and hasattr(user, "user_profile"):
            return user.user_profile.full_name
        if user.role == "agent" and hasattr(user, "agent_profile"):
            return user.agent_profile.full_name
    except Exception:
        pass
    return user.email.split("@")[0]


class ChatConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for chat. Room is identified by room_id in URL."""

    async def connect(self):
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        query_string = self.scope.get("query_string", b"").decode()
        token = None
        for part in query_string.split("&"):
            if part.startswith("token="):
                token = part.split("=", 1)[1].strip()
                break

        self.user = await get_user_sync(self.scope, token)
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        can_access = await user_can_access_room(self.user, self.room_id)
        if not can_access:
            await self.close(code=4003)
            return

        self.room_group_name = f"chat_{self.room_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get("type", "message")
        if msg_type != "message":
            return

        text = (data.get("text") or "").strip()
        if not text:
            return

        msg = await save_message(self.room_id, self.user, text)
        if not msg:
            return

        sender_name = await get_user_display(self.user)
        payload = {
            "type": "chat_message",
            "id": msg.id,
            "text": msg.text,
            "sender_id": self.user.id,
            "sender_name": sender_name,
            "created_at": msg.created_at.isoformat(),
        }

        await self.channel_layer.group_send(self.room_group_name, payload)

    async def chat_message(self, event):
        """Send message to WebSocket."""
        await self.send(text_data=json.dumps(event))
