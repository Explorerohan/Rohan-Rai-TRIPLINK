from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import Booking, BookingAgentType, Package, PackageStatus, Roles, User


class BookingAgentTypePricingTests(TestCase):
    def setUp(self):
        self.agent = User.objects.create_user(
            email="agent_agenttype@test.com",
            password="testpass123",
            role=Roles.AGENT,
        )
        self.traveler = User.objects.create_user(
            email="traveler_agenttype@test.com",
            password="testpass123",
            role=Roles.TRAVELER,
        )
        start = date.today() + timedelta(days=12)
        self.package = Package.objects.create(
            agent=self.agent,
            title="Agent Type Trip",
            location="Kathmandu",
            country="Nepal",
            description="Desc",
            price_per_person=Decimal("100.00"),
            trip_start_date=start,
            trip_end_date=start + timedelta(days=2),
            status=PackageStatus.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.traveler)

    def test_esewa_initiate_guide_increases_price_by_twenty_percent(self):
        res = self.client.post(
            "/api/auth/payments/esewa/initiate/",
            {
                "package_id": self.package.id,
                "traveler_count": 2,
                "agent_type": BookingAgentType.GUIDE,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data.get("agent_type"), BookingAgentType.GUIDE)
        self.assertEqual(Decimal(str(res.data.get("price_per_person"))), Decimal("120.00"))
        self.assertEqual(Decimal(str(res.data.get("total_amount"))), Decimal("240.00"))

    def test_direct_booking_regular_default_keeps_base_price(self):
        res = self.client.post(
            "/api/auth/bookings/",
            {"package_id": self.package.id, "traveler_count": 2},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        booking = Booking.objects.get(pk=res.data["id"])
        self.assertEqual(booking.agent_type, BookingAgentType.REGULAR)
        self.assertEqual(booking.price_per_person_snapshot, Decimal("100.00"))
        self.assertEqual(booking.total_amount, Decimal("200.00"))

    def test_direct_booking_guide_applies_twenty_percent_markup(self):
        res = self.client.post(
            "/api/auth/bookings/",
            {
                "package_id": self.package.id,
                "traveler_count": 3,
                "agent_type": BookingAgentType.GUIDE,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        booking = Booking.objects.get(pk=res.data["id"])
        self.assertEqual(booking.agent_type, BookingAgentType.GUIDE)
        self.assertEqual(booking.price_per_person_snapshot, Decimal("120.00"))
        self.assertEqual(booking.total_amount, Decimal("360.00"))

    def test_esewa_initiate_rejects_invalid_agent_type(self):
        res = self.client.post(
            "/api/auth/payments/esewa/initiate/",
            {
                "package_id": self.package.id,
                "traveler_count": 1,
                "agent_type": "vip",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("agent_type", res.data)
