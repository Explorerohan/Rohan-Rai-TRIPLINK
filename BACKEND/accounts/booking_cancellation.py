"""Traveler booking cancellation: 2-day rule, seats, reward points, manual refund queue."""
from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal

from django.core.files import File
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers as drf_serializers

from .models import (
    Booking,
    BookingStatus,
    PaymentMethod,
    PaymentStatus,
    RefundRequest,
    RefundRequestStatus,
    UserProfile,
)

logger = logging.getLogger(__name__)


def can_cancel_booking(booking: Booking) -> tuple[bool, str | None]:
    """Return (allowed, error_message). Mirrors the public API cancellation rules."""
    if booking.status == BookingStatus.CANCELLED:
        return False, "This booking is already cancelled."
    start = booking.package.trip_start_date
    if start and (start - date.today()).days < 2:
        return False, "You can only cancel a booking at least 2 days before the trip start date."
    return True, None


def _restore_reward_points(booking: Booking) -> None:
    rp = int(booking.reward_points_used or 0)
    if rp <= 0:
        return
    try:
        profile = UserProfile.objects.select_for_update().get(user_id=booking.user_id)
    except UserProfile.DoesNotExist:
        logger.warning("UserProfile missing for user %s; cannot restore reward points.", booking.user_id)
        return
    profile.reward_points = int(profile.reward_points or 0) + rp
    profile.save(update_fields=["reward_points", "updated_at"])


def _needs_manual_refund_queue(booking: Booking) -> bool:
    """Paid bookings that require staff to send money manually (eSewa QR workflow)."""
    if booking.payment_status != PaymentStatus.PAID:
        return False
    if (booking.payment_reference or "").strip() == "REWARD_POINTS_ONLY":
        return False
    if booking.payment_method == PaymentMethod.ESEWA:
        return True
    try:
        if booking.total_amount and Decimal(booking.total_amount) > 0:
            return True
    except Exception:
        pass
    return False


def _create_refund_request(booking: Booking, profile: UserProfile) -> RefundRequest:
    pkg = booking.package
    traveler = booking.user
    rr = RefundRequest(
        booking=booking,
        traveler=traveler,
        package=pkg,
        status=RefundRequestStatus.PENDING,
        total_amount=booking.total_amount or 0,
        payment_method=booking.payment_method or "",
        payment_reference=booking.payment_reference or "",
        transaction_uuid=booking.transaction_uuid or "",
        traveler_email=traveler.email or "",
        traveler_name=profile.full_name,
        package_title=pkg.title or "",
        trip_start_date=pkg.trip_start_date,
    )
    rr.save()
    if profile.refund_qr:
        try:
            profile.refund_qr.open("rb")
            rr.traveler_qr_snapshot.save(f"qr_booking_{booking.pk}.jpg", File(profile.refund_qr), save=True)
        finally:
            profile.refund_qr.close()
    return rr


def cancel_traveler_booking(booking: Booking) -> Booking:
    """
    Cancel a confirmed booking: seats, reward points, optional manual RefundRequest.
    Raises ValidationError if paid cancellation requires refund QR but none is set on profile.
    """
    with transaction.atomic():
        booking = (
            Booking.objects.select_for_update()
            .select_related("package", "user")
            .get(pk=booking.pk)
        )

        ok, err = can_cancel_booking(booking)
        if not ok:
            raise drf_serializers.ValidationError({"status": err})

        if RefundRequest.objects.filter(booking_id=booking.pk).exists():
            raise drf_serializers.ValidationError({"detail": "A refund request already exists for this booking."})

        profile, _ = UserProfile.objects.select_for_update().get_or_create(user_id=booking.user_id)

        needs_queue = _needs_manual_refund_queue(booking)
        if needs_queue:
            if not profile.refund_qr:
                raise drf_serializers.ValidationError(
                    {
                        "refund_qr": (
                            "Please upload your refund QR code in Profile before cancelling a paid booking. "
                            "Open Profile → add your eSewa QR under Refund QR."
                        )
                    }
                )

        _restore_reward_points(booking)

        if needs_queue:
            _create_refund_request(booking, profile)
            booking.payment_status = PaymentStatus.REFUND_PENDING
        else:
            booking.payment_status = PaymentStatus.REFUNDED
            booking.refunded_at = timezone.now()

        booking.status = BookingStatus.CANCELLED
        package = booking.package
        decrement_by = max(int(getattr(booking, "traveler_count", 1) or 1), 1)
        package.participants_count = max((package.participants_count or 0) - decrement_by, 0)
        package.save(update_fields=["participants_count"])

        booking.save(
            update_fields=[
                "status",
                "payment_status",
                "refunded_at",
                "esewa_refund_reference",
            ]
        )
        return booking
