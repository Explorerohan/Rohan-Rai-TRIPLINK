# Chat System - Backend Implementation

Real-time chat between **agents** and **travelers** using WebSockets (Django Channels).

## Setup

1. Install dependencies:
   ```
   pip install channels daphne
   ```

2. Run migrations:
   ```
   python manage.py migrate
   ```

3. Start the server (Daphne is used automatically for WebSocket support):
   ```
   python manage.py runserver
   ```

## Features

- **ChatRoom** – One room per traveler–agent pair
- **ChatMessage** – Messages stored in DB, delivered in real-time via WebSocket
- **REST API** – List rooms, create room, list/create messages
- **WebSocket** – Real-time send/receive when a room is open

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/chat/rooms/` | List your chat rooms |
| POST | `/api/auth/chat/rooms/` | Create room: `{"agent_id": N}` (traveler) or `{"traveler_id": N}` (agent) |
| GET | `/api/auth/chat/rooms/<id>/messages/` | List messages (paginated) |
| POST | `/api/auth/chat/rooms/<id>/messages/` | Send message: `{"text": "..."}` |

## WebSocket

- URL: `ws://<host>/ws/chat/<room_id>/`
- **Agent web**: Session auth (cookies)
- **Mobile (future)**: Add `?token=<jwt_access_token>` to the URL

## Agent Dashboard

The agent chat UI at `/chat/agent/` loads rooms from the API, connects via WebSocket when a room is selected, and sends/receives messages in real time.
