"""
Send push notifications via Expo Push API when in-app notifications are created.
https://docs.expo.dev/push-notifications/sending-notifications/
"""
import json
import logging
from urllib.error import URLError, HTTPError
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
CHUNK_SIZE = 99  # Expo allows up to 100 messages per request


def send_expo_push_for_notification(notification, recipient_user_ids):
    """
    Send Expo push to all registered devices for the given user IDs.

    :param notification: Notification model instance (must have id, title, message)
    :param recipient_user_ids: iterable of user pk (int)
    """
    from .models import ExpoPushToken

    if not recipient_user_ids:
        return

    user_ids = list({int(uid) for uid in recipient_user_ids if uid is not None})
    if not user_ids:
        return

    tokens = list(
        ExpoPushToken.objects.filter(user_id__in=user_ids).values_list("token", flat=True).distinct()
    )
    if not tokens:
        return

    title = (notification.title or "TRIPLINK")[:200]
    body = (notification.message or "")[:1000]
    notif_id = str(notification.id)

    messages = [
        {
            "to": t,
            "title": title,
            "body": body,
            "sound": "default",
            "data": {
                "type": "triplink_notification",
                "notification_id": notif_id,
            },
        }
        for t in tokens
    ]

    for i in range(0, len(messages), CHUNK_SIZE):
        chunk = messages[i : i + CHUNK_SIZE]
        try:
            payload = json.dumps(chunk).encode("utf-8")
            req = Request(
                EXPO_PUSH_URL,
                data=payload,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                method="POST",
            )
            with urlopen(req, timeout=45) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
            logger.info("Expo push response (chunk %s): %s", i // CHUNK_SIZE + 1, raw[:800])
        except HTTPError as e:
            try:
                err_body = e.read().decode("utf-8", errors="replace")
            except Exception:
                err_body = str(e)
            logger.warning("Expo push HTTP error: %s %s", e.code, err_body[:500])
        except URLError as e:
            logger.warning("Expo push network error: %s", e)
        except Exception:
            logger.exception("Expo push failed unexpectedly")
