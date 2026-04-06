"""
Automated in-app + Expo push notifications for confirmed bookings:
- ~24h before trip start
- ~1h before trip start
- After trip end date (eligible for review): prompt to review the agent

Run periodically via: python manage.py send_booking_trip_reminders
(Recommend every 10–15 minutes so 24h/1h windows are hit reliably.)
"""
from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import (
    AgentProfile,
    AgentReview,
    Booking,
    BookingStatus,
    BookingTripReminder,
    BookingTripReminderKind,
    Notification,
    NotificationRecipient,
    NotificationType,
    Package,
    PackageStatus,
    Roles,
    User,
)
from .push_notifications import send_expo_push_for_notification

logger = logging.getLogger(__name__)

SYSTEM_NOTIFICATION_EMAIL = "triplink-system@notifications.local"
DEFAULT_TRIP_START_TIME = time(9, 0)


def get_system_notification_sender() -> User:
    user, created = User.objects.get_or_create(
        email=SYSTEM_NOTIFICATION_EMAIL,
        defaults={
            "role": Roles.ADMIN,
            "is_active": True,
        },
    )
    if created:
        user.set_unusable_password()
        user.save()
    return user


def mark_overdue_packages_completed() -> int:
    """Same rule as API: active packages with trip_end_date before today become completed."""
    return Package.objects.filter(
        status=PackageStatus.ACTIVE,
        trip_end_date__isnull=False,
        trip_end_date__lt=date.today(),
    ).update(status=PackageStatus.COMPLETED)


def _trip_start_datetime(trip_start_date, trip_start_time) -> datetime:
    tz = timezone.get_current_timezone()
    t = trip_start_time or DEFAULT_TRIP_START_TIME
    naive = datetime.combine(trip_start_date, t)
    return timezone.make_aware(naive, tz)


def _create_notification_for_user(sender: User, title: str, message: str, notif_type: str, user_id: int):
    with transaction.atomic():
        notification = Notification.objects.create(
            title=title,
            message=message,
            notification_type=notif_type,
            sender=sender,
        )
        NotificationRecipient.objects.create(notification=notification, user_id=user_id)
    send_expo_push_for_notification(notification, [user_id])


def process_booking_trip_reminders() -> dict:
    """
    Send due reminders. Idempotent via BookingTripReminder rows.
    Returns counts for logging.
    """
    mark_overdue_packages_completed()
    sender = get_system_notification_sender()
    now = timezone.now()

    counts = {"h24": 0, "h1": 0, "review": 0}

    base_qs = (
        Booking.objects.filter(status=BookingStatus.CONFIRMED)
        .select_related("package", "package__agent")
        .filter(package__trip_start_date__isnull=False)
    )

    # --- Pre-trip: 24h and 1h ---
    for booking in base_qs.filter(
        package__status=PackageStatus.ACTIVE,
    ).iterator(chunk_size=200):
        pkg = booking.package
        start_dt = _trip_start_datetime(pkg.trip_start_date, pkg.trip_start_time)

        if now >= start_dt:
            continue

        # 24 hours before start (first run after this instant)
        if (
            now >= start_dt - timedelta(hours=24)
            and not BookingTripReminder.objects.filter(
                booking=booking, kind=BookingTripReminderKind.H24
            ).exists()
        ):
            loc = f"{pkg.location}, {pkg.country}" if pkg.country else pkg.location
            title = f"Your trip starts in 24 hours — {pkg.title}"
            message = (
                f"Get ready for {pkg.title} in {loc}. "
                f"Departure is scheduled for {start_dt.strftime('%b %d, %Y at %I:%M %p')} ({settings.TIME_ZONE}). "
                "Check your itinerary and travel documents."
            )
            with transaction.atomic():
                BookingTripReminder.objects.create(booking=booking, kind=BookingTripReminderKind.H24)
                _create_notification_for_user(
                    sender,
                    title,
                    message,
                    NotificationType.TRIP_REMINDER_24H,
                    booking.user_id,
                )
            counts["h24"] += 1

        # 1 hour before start
        if (
            now >= start_dt - timedelta(hours=1)
            and not BookingTripReminder.objects.filter(
                booking=booking, kind=BookingTripReminderKind.H1
            ).exists()
        ):
            loc = f"{pkg.location}" + (f", {pkg.country}" if pkg.country else "")
            title = f"Starting soon: {pkg.title}"
            message = (
                f"Your trip to {loc} begins in about an hour "
                f"({start_dt.strftime('%I:%M %p')}). Have a great journey!"
            )
            with transaction.atomic():
                BookingTripReminder.objects.create(booking=booking, kind=BookingTripReminderKind.H1)
                _create_notification_for_user(
                    sender,
                    title,
                    message,
                    NotificationType.TRIP_REMINDER_1H,
                    booking.user_id,
                )
            counts["h1"] += 1

    # --- Post-trip review (same eligibility idea as AgentReviewSerializer) ---
    review_qs = (
        Booking.objects.filter(status=BookingStatus.CONFIRMED)
        .select_related("package", "package__agent")
        .filter(
            package__trip_end_date__isnull=False,
            package__trip_end_date__lte=date.today(),
        )
    )

    for booking in review_qs.iterator(chunk_size=200):
        pkg = booking.package
        agent = pkg.agent
        if AgentReview.objects.filter(user=booking.user, agent=agent).exists():
            continue
        # One review prompt per traveler+agent (not per booking)
        if BookingTripReminder.objects.filter(
            kind=BookingTripReminderKind.REVIEW,
            booking__user_id=booking.user_id,
            booking__package__agent_id=agent.id,
        ).exists():
            continue

        title = f"How was {pkg.title}?"
        try:
            agent_label = agent.agent_profile.full_name
        except AgentProfile.DoesNotExist:
            agent_label = agent.email.split("@")[0]

        message = (
            f"You have finished your trip to {pkg.location}. "
            f"Please take a moment to review your agent ({agent_label}) on TRIPLINK — it helps other travelers."
        )

        with transaction.atomic():
            BookingTripReminder.objects.create(booking=booking, kind=BookingTripReminderKind.REVIEW)
            _create_notification_for_user(
                sender,
                title,
                message,
                NotificationType.TRIP_REVIEW_REQUEST,
                booking.user_id,
            )
        counts["review"] += 1

    return counts
