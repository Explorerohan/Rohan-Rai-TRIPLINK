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
        logger.info(
            "Expo push skipped: no device tokens for user_ids=%s (notification_id=%s). "
            "User must open the app on a physical device with notifications allowed.",
            user_ids,
            getattr(notification, "id", None),
        )
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


def create_and_send_deal_notification(deal):
    """
    Create an in-app notification for a newly created deal and send push to all travelers.

    :param deal: Deal model instance (must have package and agent populated)
    """
    from django.db import transaction

    from .models import Notification, NotificationRecipient, Roles, User

    package = deal.package
    agent = deal.agent
    valid_until_str = deal.valid_until.strftime("%b %d, %Y") if deal.valid_until else ""

    title = f"Hot Deal: {package.title}"
    message = f"{deal.discount_percent}% off! Book before {valid_until_str}."

    recipients = User.objects.filter(role=Roles.TRAVELER)
    if not recipients.exists():
        logger.info("No travelers to notify for deal %s", deal.id)
        return

    with transaction.atomic():
        notification = Notification.objects.create(
            title=title,
            message=message,
            notification_type="promotion",
            sender=agent,
        )
        NotificationRecipient.objects.bulk_create(
            [NotificationRecipient(notification=notification, user=u) for u in recipients]
        )

    recipient_ids = list(recipients.values_list("id", flat=True))
    send_expo_push_for_notification(notification, recipient_ids)


def _agent_display_name(agent):
    """Best-effort display name for an agent user."""
    from .models import AgentProfile

    try:
        ap = agent.agent_profile
        name = ap.full_name
        if name and str(name).strip():
            return str(name).strip()
    except AgentProfile.DoesNotExist:
        pass
    fn = agent.get_full_name()
    if fn and str(fn).strip():
        return str(fn).strip()
    email = getattr(agent, "email", "") or ""
    return email.split("@")[0] if email else "Your agent"


def create_private_offer_published_notification(agent, package, traveler_user):
    """
    In-app notification for the traveler when their custom request is turned into a payable package.

    Does not send push; caller should call send_expo_push_for_notification inside transaction.on_commit.
    """
    from .models import Notification, NotificationRecipient, NotificationType

    traveler_id = getattr(traveler_user, "pk", None) or getattr(traveler_user, "id", None)
    if not traveler_id:
        logger.warning("create_private_offer_published_notification: missing traveler id")
        return None

    agent_name = _agent_display_name(agent)
    pkg_title = (package.title or "Your trip")[:180]

    title = "Your trip is ready to book"
    message = (
        f"{agent_name} published a bookable offer for “{pkg_title}”. "
        "Open your custom trip in the TRIPLINK app to review details and pay."
    )

    notification = Notification.objects.create(
        title=title[:200],
        message=message[:2000],
        notification_type=NotificationType.UPDATE,
        sender=agent,
    )
    NotificationRecipient.objects.create(notification=notification, user_id=traveler_id)
    return notification
