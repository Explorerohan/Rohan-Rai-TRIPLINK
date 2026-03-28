"""Tests for booking cancellation, reward restoration, and manual refund queue (eSewa QR)."""
from datetime import date, timedelta
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import (
    Booking,
    BookingStatus,
    EsewaPaymentSession,
    EsewaPaymentSessionStatus,
    Package,
    PackageStatus,
    PaymentMethod,
    PaymentStatus,
    RefundRequest,
    Roles,
    User,
    UserProfile,
)

# Minimal valid 1x1 PNG (avoids Pillow validation issues in ImageField)
_MIN_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _attach_refund_qr(profile: UserProfile) -> None:
    f = SimpleUploadedFile("qr.png", _MIN_PNG, content_type="image/png")
    profile.refund_qr.save("qr.png", f, save=True)


class BookingCancellationRefundTests(TestCase):
    def setUp(self):
        self.agent = User.objects.create_user(
            email="agent_refund@test.com",
            password="testpass123",
            role=Roles.AGENT,
        )
        self.traveler = User.objects.create_user(
            email="traveler_refund@test.com",
            password="testpass123",
            role=Roles.TRAVELER,
        )
        self.profile = UserProfile.objects.create(user=self.traveler, reward_points=90)
        start = date.today() + timedelta(days=10)
        self.package = Package.objects.create(
            agent=self.agent,
            title="Test Trip",
            location="Pokhara",
            country="Nepal",
            description="Desc",
            price_per_person=Decimal("100.00"),
            trip_start_date=start,
            trip_end_date=start + timedelta(days=3),
            status=PackageStatus.ACTIVE,
            participants_count=1,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.traveler)

    def test_cancel_too_close_to_trip_returns_400(self):
        self.package.trip_start_date = date.today() + timedelta(days=1)
        self.package.save(update_fields=["trip_start_date"])
        booking = Booking.objects.create(
            user=self.traveler,
            package=self.package,
            status=BookingStatus.CONFIRMED,
            traveler_count=1,
            price_per_person_snapshot=Decimal("100.00"),
            total_amount=Decimal("100.00"),
            payment_method=PaymentMethod.DIRECT,
            payment_status=PaymentStatus.PAID,
        )
        res = self.client.patch(
            f"/api/auth/bookings/{booking.pk}/",
            {"status": "cancelled"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        booking.refresh_from_db()
        self.assertEqual(booking.status, BookingStatus.CONFIRMED)

    def test_esewa_cancel_without_refund_qr_returns_400(self):
        booking = Booking.objects.create(
            user=self.traveler,
            package=self.package,
            status=BookingStatus.CONFIRMED,
            traveler_count=1,
            price_per_person_snapshot=Decimal("100.00"),
            total_amount=Decimal("100.00"),
            payment_method=PaymentMethod.ESEWA,
            payment_status=PaymentStatus.PAID,
            payment_reference="REF001",
            transaction_uuid="txn-test-1",
            reward_points_used=10,
        )
        EsewaPaymentSession.objects.create(
            user=self.traveler,
            package=self.package,
            booking=booking,
            transaction_uuid="txn-test-1",
            traveler_count=1,
            price_per_person_snapshot=Decimal("100.00"),
            total_amount=Decimal("100.00"),
            payable_amount=Decimal("50.00"),
            reward_points_used=10,
            status=EsewaPaymentSessionStatus.VERIFIED,
            payment_reference="REF001",
        )

        res = self.client.patch(
            f"/api/auth/bookings/{booking.pk}/",
            {"status": "cancelled"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("refund_qr", res.data)
        booking.refresh_from_db()
        self.assertEqual(booking.status, BookingStatus.CONFIRMED)

    def test_esewa_cancel_with_refund_qr_sets_refund_pending_and_creates_request(self):
        _attach_refund_qr(self.profile)
        self.profile.refresh_from_db()

        booking = Booking.objects.create(
            user=self.traveler,
            package=self.package,
            status=BookingStatus.CONFIRMED,
            traveler_count=1,
            price_per_person_snapshot=Decimal("100.00"),
            total_amount=Decimal("100.00"),
            payment_method=PaymentMethod.ESEWA,
            payment_status=PaymentStatus.PAID,
            payment_reference="REF001",
            transaction_uuid="txn-test-1",
            reward_points_used=10,
        )
        EsewaPaymentSession.objects.create(
            user=self.traveler,
            package=self.package,
            booking=booking,
            transaction_uuid="txn-test-1",
            traveler_count=1,
            price_per_person_snapshot=Decimal("100.00"),
            total_amount=Decimal("100.00"),
            payable_amount=Decimal("50.00"),
            reward_points_used=10,
            status=EsewaPaymentSessionStatus.VERIFIED,
            payment_reference="REF001",
        )

        res = self.client.patch(
            f"/api/auth/bookings/{booking.pk}/",
            {"status": "cancelled"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        booking.refresh_from_db()
        self.profile.refresh_from_db()
        self.assertEqual(booking.status, BookingStatus.CANCELLED)
        self.assertEqual(booking.payment_status, PaymentStatus.REFUND_PENDING)
        self.assertEqual(self.profile.reward_points, 100)
        self.package.refresh_from_db()
        self.assertEqual(self.package.participants_count, 0)
        self.assertTrue(RefundRequest.objects.filter(booking=booking).exists())
        rr = RefundRequest.objects.get(booking=booking)
        self.assertTrue(rr.traveler_qr_snapshot.name)

    def test_cancel_already_cancelled_returns_400(self):
        booking = Booking.objects.create(
            user=self.traveler,
            package=self.package,
            status=BookingStatus.CANCELLED,
            traveler_count=1,
            price_per_person_snapshot=Decimal("100.00"),
            total_amount=Decimal("100.00"),
            payment_method=PaymentMethod.DIRECT,
            payment_status=PaymentStatus.REFUNDED,
        )
        res = self.client.patch(
            f"/api/auth/bookings/{booking.pk}/",
            {"status": "cancelled"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
