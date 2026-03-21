import base64
import hashlib
import hmac
import json
import time
import uuid
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
from urllib.error import URLError, HTTPError
from urllib.parse import urlencode
from urllib.request import urlopen
from django.conf import settings
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib import messages
from django.db import transaction
from django.db.models import Q, Count, Sum, Avg, Max
from django.db.models.functions import TruncMonth
from django.http import HttpResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from rest_framework import generics, permissions, response, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .emailjs_utils import generate_otp, send_otp_email, send_agent_credentials_email
from .models import (
    Roles,
    UserProfile,
    AgentProfile,
    Package,
    PackageFeature,
    PackageStatus,
    PackageBookmark,
    Deal,
    get_active_deal,
    CustomPackage,
    Booking,
    BookingStatus,
    PaymentMethod,
    PaymentStatus,
    EsewaPaymentSession,
    EsewaPaymentSessionStatus,
    AgentReview,
    ChatRoom,
    ChatMessage,
    ItineraryTrip,
    ItineraryItem,
    Notification,
    NotificationRecipient,
    ExpoPushToken,
)
from .feature_options import get_feature_icon, get_all_feature_options
from .permissions import IsAdminRole, IsAgent, IsTraveler
from .serializers import (
    CustomTokenObtainPairSerializer,
    RegisterSerializer,
    UserSerializer,
    UserProfileSerializer,
    AgentProfileSerializer,
    PublicAgentDetailSerializer,
    PackageSerializer,
    BookingSerializer,
    PackageDetailSerializer,
    AgentReviewSerializer,
    CustomPackageSerializer,
    PackageFeatureSerializer,
    ChatRoomSerializer,
    ChatMessageSerializer,
    ItineraryItemSerializer,
    NotificationSerializer,
    NotificationCreateSerializer,
    ExpoPushTokenRegisterSerializer,
)
from .push_notifications import send_expo_push_for_notification

User = get_user_model()


def _money(value):
    return Decimal(str(value or "0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _money_str(value):
    return format(_money(value), ".2f")


def _esewa_product_code():
    return getattr(settings, "ESEWA_PRODUCT_CODE", "EPAYTEST")


def _esewa_secret_key():
    # eSewa UAT default key from official docs/examples; override in env/settings for production.
    return getattr(settings, "ESEWA_SECRET_KEY", "8gBm/:&EnhH.1/q")


def _esewa_form_url():
    return getattr(settings, "ESEWA_FORM_URL", "https://rc-epay.esewa.com.np/api/epay/main/v2/form")


def _esewa_status_url():
    return getattr(settings, "ESEWA_STATUS_URL", "https://rc.esewa.com.np/api/epay/transaction/status/")


def _esewa_signature(total_amount, transaction_uuid, product_code):
    message = f"total_amount={_money_str(total_amount)},transaction_uuid={transaction_uuid},product_code={product_code}"
    digest = hmac.new(
        _esewa_secret_key().encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return base64.b64encode(digest).decode("utf-8")


def _build_esewa_form_fields(request, payment_session):
    success_url = request.build_absolute_uri(reverse("esewa_payment_success_callback"))
    failure_url = request.build_absolute_uri(reverse("esewa_payment_failure_callback"))
    # Use payable_amount when set (after applying any reward points), otherwise fall back to total_amount
    base_amount = payment_session.payable_amount or payment_session.total_amount
    total_amount = _money(base_amount)
    product_code = payment_session.product_code or _esewa_product_code()
    signature = _esewa_signature(total_amount, payment_session.transaction_uuid, product_code)
    return {
        "amount": _money_str(total_amount),
        "tax_amount": "0.00",
        "total_amount": _money_str(total_amount),
        "transaction_uuid": payment_session.transaction_uuid,
        "product_code": product_code,
        "product_service_charge": "0.00",
        "product_delivery_charge": "0.00",
        "success_url": success_url,
        "failure_url": failure_url,
        "signed_field_names": "total_amount,transaction_uuid,product_code",
        "signature": signature,
    }


def _verify_esewa_transaction(payment_session):
    query = urlencode(
        {
            "product_code": payment_session.product_code or _esewa_product_code(),
            # Must match the amount sent to eSewa when initiating the payment
            "total_amount": _money_str(payment_session.payable_amount or payment_session.total_amount),
            "transaction_uuid": payment_session.transaction_uuid,
        }
    )
    url = f"{_esewa_status_url()}?{query}"
    try:
        with urlopen(url, timeout=15) as res:
            raw = res.read().decode("utf-8")
    except (HTTPError, URLError, TimeoutError) as exc:
        raise RuntimeError(f"Unable to verify eSewa payment right now: {exc}") from exc

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Invalid response received from eSewa verification API.") from exc

    return payload


def _booking_payment_summary_html(title, message, color="#1f6b2a"):
    safe_title = str(title)
    safe_message = str(message)
    return f"""
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{safe_title}</title>
      </head>
      <body style="margin:0;font-family:Arial,sans-serif;background:#f4f6f8;color:#1f2937;">
        <div style="max-width:560px;margin:40px auto;padding:24px;background:#fff;border-radius:14px;border:1px solid #e5e7eb;">
          <h2 style="margin:0 0 12px;color:{color};">{safe_title}</h2>
          <p style="margin:0 0 8px;line-height:1.5;">{safe_message}</p>
          <p style="margin:0;color:#6b7280;line-height:1.5;">Return to the TRIPLINK app and tap Verify Payment.</p>
        </div>
      </body>
    </html>
    """


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]


class RefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class TravelerOnlyView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated, IsTraveler]

    def get(self, request):
        return response.Response({"message": "Hello Traveler", "email": request.user.email})


class AgentOnlyView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAgent]

    def get(self, request):
        return response.Response({"message": "Hello Agent", "email": request.user.email})


class AdminOnlyView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        return response.Response({"message": "Hello Admin", "email": request.user.email})


class LogoutView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # With JWT, logout is primarily handled client-side by discarding tokens
        # This endpoint provides a way to notify the server of logout
        # For proper token invalidation, consider implementing token blacklisting
        return response.Response(
            {"message": "Successfully logged out", "detail": "Token should be discarded on client side"},
            status=200
        )


# Template-based views for unified login
@never_cache
@ensure_csrf_cookie
def login_view(request):
    """Unified login view that handles both admin and agent login"""
    # If user is already authenticated, redirect to appropriate dashboard
    if request.user.is_authenticated:
        if request.user.role == Roles.ADMIN:
            return redirect('admin_dashboard')
        elif request.user.role == Roles.AGENT:
            return redirect('agent_dashboard')
        # For other roles (like traveler), redirect to login page
        logout(request)
    
    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')
        
        if email and password:
            user = authenticate(request, username=email, password=password)
            if user is not None:
                # Check if user is admin or agent (only these roles can use this login)
                if user.role == Roles.ADMIN:
                    login(request, user)
                    return redirect('admin_dashboard')
                elif user.role == Roles.AGENT:
                    login(request, user)
                    return redirect('agent_dashboard')
                else:
                    messages.error(request, 'Access denied. This login page is only for admin and agent accounts.')
            else:
                messages.error(request, 'Invalid email or password.')
        else:
            messages.error(request, 'Please fill in all fields.')
    
    return render(request, 'login.html')

def _shift_month(month_start, delta):
    """Shift a first-of-month date by delta months."""
    month_index = (month_start.year * 12 + month_start.month - 1) + delta
    year = month_index // 12
    month = month_index % 12 + 1
    return month_start.replace(year=year, month=month, day=1)


def _safe_pct(numerator, denominator):
    if not denominator:
        return 0.0
    return round((numerator / denominator) * 100, 1)


def _pct_change(current, previous):
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round(((current - previous) / previous) * 100, 1)


def _month_key(value):
    if not value:
        return ""
    if hasattr(value, "date"):
        value = value.date()
    return value.strftime("%Y-%m")


def admin_dashboard_view(request):
    """Admin dashboard with actionable platform metrics and visual data."""
    if not request.user.is_authenticated or request.user.role != Roles.ADMIN:
        messages.error(request, 'Access denied. Admin access required.')
        return redirect('login')

    now = timezone.now()
    today = timezone.localdate()
    current_month_start = today.replace(day=1)
    previous_month_start = _shift_month(current_month_start, -1)
    next_month_start = _shift_month(current_month_start, 1)
    month_starts = [_shift_month(current_month_start, offset) for offset in range(-5, 1)]
    month_labels = [m.strftime("%b %Y") for m in month_starts]
    month_keys = [m.strftime("%Y-%m") for m in month_starts]
    start_window = month_starts[0]

    total_users = User.objects.count()
    total_admins = User.objects.filter(role=Roles.ADMIN).count()
    total_travelers = User.objects.filter(role=Roles.TRAVELER).count()
    total_agents = User.objects.filter(role=Roles.AGENT).count()

    avg_agent_rating = AgentProfile.objects.filter(user__role=Roles.AGENT).aggregate(avg=Avg("rating"))["avg"] or 0

    total_packages = Package.objects.count()
    active_packages = Package.objects.filter(status=PackageStatus.ACTIVE).count()
    completed_packages = Package.objects.filter(status=PackageStatus.COMPLETED).count()
    draft_packages = Package.objects.filter(status=PackageStatus.DRAFT).count()

    total_bookings = Booking.objects.count()
    confirmed_bookings = Booking.objects.filter(status=BookingStatus.CONFIRMED).count()
    cancelled_bookings = Booking.objects.filter(status=BookingStatus.CANCELLED).count()

    total_custom_packages = CustomPackage.objects.count()
    custom_open = CustomPackage.objects.filter(status=CustomPackage.CustomPackageStatus.OPEN).count()
    custom_claimed = CustomPackage.objects.filter(status=CustomPackage.CustomPackageStatus.CLAIMED).count()
    custom_completed = CustomPackage.objects.filter(status=CustomPackage.CustomPackageStatus.COMPLETED).count()
    custom_cancelled = CustomPackage.objects.filter(status=CustomPackage.CustomPackageStatus.CANCELLED).count()

    total_chat_rooms = ChatRoom.objects.count()
    total_messages = ChatMessage.objects.count()
    messages_last_30_days = ChatMessage.objects.filter(created_at__gte=now - timedelta(days=30)).count()

    estimated_revenue = (
        Booking.objects.filter(status=BookingStatus.CONFIRMED)
        .aggregate(total=Sum("package__price_per_person"))
        .get("total")
        or 0
    )

    travelers_this_month = User.objects.filter(
        role=Roles.TRAVELER,
        date_joined__gte=current_month_start,
        date_joined__lt=next_month_start,
    ).count()
    travelers_last_month = User.objects.filter(
        role=Roles.TRAVELER,
        date_joined__gte=previous_month_start,
        date_joined__lt=current_month_start,
    ).count()
    bookings_this_month = Booking.objects.filter(
        created_at__gte=current_month_start,
        created_at__lt=next_month_start,
    ).count()
    bookings_last_month = Booking.objects.filter(
        created_at__gte=previous_month_start,
        created_at__lt=current_month_start,
    ).count()
    packages_this_month = Package.objects.filter(
        created_at__gte=current_month_start,
        created_at__lt=next_month_start,
    ).count()
    packages_last_month = Package.objects.filter(
        created_at__gte=previous_month_start,
        created_at__lt=current_month_start,
    ).count()

    traveler_growth_qs = (
        User.objects.filter(role=Roles.TRAVELER, date_joined__date__gte=start_window)
        .annotate(month=TruncMonth("date_joined"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    )
    booking_growth_qs = (
        Booking.objects.filter(created_at__date__gte=start_window)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    )
    package_growth_qs = (
        Package.objects.filter(created_at__date__gte=start_window)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    )
    custom_growth_qs = (
        CustomPackage.objects.filter(created_at__date__gte=start_window)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    )

    traveler_growth_map = {_month_key(item["month"]): item["count"] for item in traveler_growth_qs}
    booking_growth_map = {_month_key(item["month"]): item["count"] for item in booking_growth_qs}
    package_growth_map = {_month_key(item["month"]): item["count"] for item in package_growth_qs}
    custom_growth_map = {_month_key(item["month"]): item["count"] for item in custom_growth_qs}

    monthly_trends = {
        "labels": month_labels,
        "travelers": [traveler_growth_map.get(key, 0) for key in month_keys],
        "bookings": [booking_growth_map.get(key, 0) for key in month_keys],
        "packages": [package_growth_map.get(key, 0) for key in month_keys],
        "custom_requests": [custom_growth_map.get(key, 0) for key in month_keys],
    }

    top_agents_qs = (
        User.objects.filter(role=Roles.AGENT)
        .select_related("agent_profile")
        .annotate(
            confirmed_bookings=Count(
                "packages__bookings",
                filter=Q(packages__bookings__status=BookingStatus.CONFIRMED),
                distinct=True,
            ),
            active_packages=Count(
                "packages",
                filter=Q(packages__status=PackageStatus.ACTIVE),
                distinct=True,
            ),
            estimated_revenue=Sum(
                "packages__price_per_person",
                filter=Q(packages__bookings__status=BookingStatus.CONFIRMED),
            ),
        )
        .order_by("-confirmed_bookings", "-estimated_revenue", "email")[:5]
    )
    top_agents = []
    for agent in top_agents_qs:
        try:
            profile = agent.agent_profile
            display_name = profile.full_name
            rating = float(profile.rating)
        except AgentProfile.DoesNotExist:
            display_name = agent.email.split("@")[0]
            rating = 0.0
        top_agents.append(
            {
                "name": display_name,
                "email": agent.email,
                "confirmed_bookings": agent.confirmed_bookings or 0,
                "active_packages": agent.active_packages or 0,
                "estimated_revenue": agent.estimated_revenue or 0,
                "rating": rating,
            }
        )

    top_destinations_rows = list(
        Booking.objects.filter(status=BookingStatus.CONFIRMED)
        .values("package__country")
        .annotate(bookings=Count("id"))
        .order_by("-bookings", "package__country")[:6]
    )
    max_destination_bookings = max((row["bookings"] for row in top_destinations_rows), default=0)
    top_destinations = [
        {
            "country": row["package__country"] or "Unknown",
            "bookings": row["bookings"],
            "percent_of_top": _safe_pct(row["bookings"], max_destination_bookings),
        }
        for row in top_destinations_rows
    ]

    recent_signups_qs = (
        User.objects.exclude(role=Roles.ADMIN)
        .order_by("-date_joined")[:8]
    )
    recent_signups = [
        {
            "email": user.email,
            "role": user.get_role_display(),
            "joined_at": user.date_joined,
        }
        for user in recent_signups_qs
    ]

    package_status = [
        {
            "label": "Active",
            "count": active_packages,
            "percent": _safe_pct(active_packages, total_packages),
            "css_class": "status-active",
        },
        {
            "label": "Completed",
            "count": completed_packages,
            "percent": _safe_pct(completed_packages, total_packages),
            "css_class": "status-completed",
        },
        {
            "label": "Draft",
            "count": draft_packages,
            "percent": _safe_pct(draft_packages, total_packages),
            "css_class": "status-draft",
        },
    ]

    custom_status = [
        {
            "label": "Open",
            "count": custom_open,
            "percent": _safe_pct(custom_open, total_custom_packages),
            "css_class": "status-open",
        },
        {
            "label": "Claimed",
            "count": custom_claimed,
            "percent": _safe_pct(custom_claimed, total_custom_packages),
            "css_class": "status-claimed",
        },
        {
            "label": "Completed",
            "count": custom_completed,
            "percent": _safe_pct(custom_completed, total_custom_packages),
            "css_class": "status-finished",
        },
        {
            "label": "Cancelled",
            "count": custom_cancelled,
            "percent": _safe_pct(custom_cancelled, total_custom_packages),
            "css_class": "status-cancelled",
        },
    ]

    booking_status = [
        {
            "label": "Confirmed",
            "count": confirmed_bookings,
            "percent": _safe_pct(confirmed_bookings, total_bookings),
            "css_class": "status-confirmed",
        },
        {
            "label": "Cancelled",
            "count": cancelled_bookings,
            "percent": _safe_pct(cancelled_bookings, total_bookings),
            "css_class": "status-cancelled",
        },
    ]

    booking_confirmed_pct = _safe_pct(confirmed_bookings, total_bookings)
    if total_bookings:
        booking_donut = (
            f"conic-gradient(#166534 0% {booking_confirmed_pct}%, "
            f"#dc2626 {booking_confirmed_pct}% 100%)"
        )
    else:
        booking_donut = "conic-gradient(#cbd5e1 0% 100%)"

    insights = []
    booking_growth_delta = _pct_change(bookings_this_month, bookings_last_month)
    if booking_growth_delta > 0:
        insights.append(f"Bookings are up {booking_growth_delta}% versus last month.")
    elif booking_growth_delta < 0:
        insights.append(f"Bookings are down {abs(booking_growth_delta)}% versus last month.")
    else:
        insights.append("Bookings are flat compared to last month.")

    if top_destinations:
        insights.append(
            f"Highest demand destination is {top_destinations[0]['country']} with {top_destinations[0]['bookings']} confirmed bookings."
        )

    context = {
        "user": request.user,
        "stats": {
            "total_users": total_users,
            "total_admins": total_admins,
            "travelers": total_travelers,
            "agents": total_agents,
            "packages": total_packages,
            "bookings": total_bookings,
            "confirmed_bookings": confirmed_bookings,
            "cancelled_bookings": cancelled_bookings,
            "custom_packages": total_custom_packages,
            "custom_open": custom_open,
            "custom_claimed": custom_claimed,
            "custom_completed": custom_completed,
            "custom_cancelled": custom_cancelled,
            "chat_rooms": total_chat_rooms,
            "messages": total_messages,
            "messages_last_30_days": messages_last_30_days,
            "estimated_revenue": estimated_revenue,
            "avg_agent_rating": round(float(avg_agent_rating), 1) if avg_agent_rating else 0.0,
            "booking_conversion_rate": _safe_pct(confirmed_bookings, total_travelers),
            "booking_cancellation_rate": _safe_pct(cancelled_bookings, total_bookings),
            "custom_resolution_rate": _safe_pct(custom_completed, total_custom_packages),
            "avg_bookings_per_agent": round(confirmed_bookings / total_agents, 1) if total_agents else 0.0,
        },
        "momentum": {
            "travelers_this_month": travelers_this_month,
            "travelers_change_pct": _pct_change(travelers_this_month, travelers_last_month),
            "bookings_this_month": bookings_this_month,
            "bookings_change_pct": booking_growth_delta,
            "packages_this_month": packages_this_month,
            "packages_change_pct": _pct_change(packages_this_month, packages_last_month),
        },
        "monthly_trends": monthly_trends,
        "top_agents": top_agents,
        "top_destinations": top_destinations,
        "recent_signups": recent_signups,
        "package_status": package_status,
        "custom_status": custom_status,
        "booking_status": booking_status,
        "booking_donut": booking_donut,
        "insights": insights,
        "active_nav": "dashboard",
    }
    return render(request, "admin_dashboard.html", context)


def admin_packages_view(request):
    """Admin view to list all agent-created packages with ownership and booking participation details."""
    if not request.user.is_authenticated or request.user.role != Roles.ADMIN:
        messages.error(request, 'Access denied. Admin access required.')
        return redirect('login')

    search_query = (request.GET.get("q") or "").strip()
    selected_status = (request.GET.get("status") or "").strip()
    selected_country = (request.GET.get("country") or "").strip()
    selected_sort = (request.GET.get("sort") or "newest").strip()

    sort_map = {
        "newest": "-created_at",
        "oldest": "created_at",
        "updated": "-updated_at",
        "price_high": "-price_per_person",
        "price_low": "price_per_person",
        "joined_high": "-joined_travelers_count",
    }
    if selected_sort not in sort_map:
        selected_sort = "newest"

    base_packages_qs = (
        Package.objects.select_related("agent", "agent__agent_profile")
        .prefetch_related("features")
        .annotate(
            confirmed_bookings_count=Count(
                "bookings",
                filter=Q(bookings__status=BookingStatus.CONFIRMED),
                distinct=True,
            ),
            joined_travelers_count=Sum(
                "bookings__traveler_count",
                filter=Q(bookings__status=BookingStatus.CONFIRMED),
            ),
        )
    )
    packages_qs = base_packages_qs
    if search_query:
        packages_qs = packages_qs.filter(
            Q(title__icontains=search_query)
            | Q(location__icontains=search_query)
            | Q(country__icontains=search_query)
            | Q(agent__email__icontains=search_query)
            | Q(agent__agent_profile__first_name__icontains=search_query)
            | Q(agent__agent_profile__last_name__icontains=search_query)
        )

    allowed_statuses = {
        PackageStatus.ACTIVE,
        PackageStatus.COMPLETED,
        PackageStatus.DRAFT,
    }
    if selected_status:
        if selected_status in allowed_statuses:
            packages_qs = packages_qs.filter(status=selected_status)
        else:
            selected_status = ""

    if selected_country:
        packages_qs = packages_qs.filter(country__iexact=selected_country)

    packages_qs = packages_qs.order_by(sort_map[selected_sort])

    available_countries = sorted(
        {
            (country or "").strip()
            for country in base_packages_qs.values_list("country", flat=True)
            if (country or "").strip()
        },
        key=lambda item: item.lower(),
    )

    packages = []
    total_joined_travelers = 0
    total_confirmed_bookings = 0
    unique_agent_ids = set()
    status_counts = {
        PackageStatus.ACTIVE: 0,
        PackageStatus.COMPLETED: 0,
        PackageStatus.DRAFT: 0,
    }
    for package in packages_qs:
        try:
            agent_profile = package.agent.agent_profile
            agent_name = agent_profile.full_name
            agent_location = agent_profile.location
        except AgentProfile.DoesNotExist:
            agent_name = package.agent.email.split("@")[0]
            agent_location = ""

        joined_travelers_count = package.joined_travelers_count
        if joined_travelers_count is None:
            joined_travelers_count = package.participants_count or 0

        total_joined_travelers += int(joined_travelers_count or 0)
        total_confirmed_bookings += int(package.confirmed_bookings_count or 0)
        unique_agent_ids.add(package.agent_id)
        if package.status in status_counts:
            status_counts[package.status] += 1

        packages.append({
            "id": package.id,
            "title": package.title,
            "location": package.location,
            "country": package.country,
            "description": package.description,
            "main_image_url": package.main_image.url if package.main_image else "",
            "feature_names": [f.name for f in package.features.all()[:4]],
            "price_per_person": package.price_per_person,
            "duration_days": package.duration_days,
            "duration_nights": package.duration_nights,
            "trip_start_date": package.trip_start_date,
            "trip_end_date": package.trip_end_date,
            "status": package.get_status_display(),
            "status_key": package.status,
            "participants_count": package.participants_count or 0,
            "joined_travelers_count": joined_travelers_count,
            "confirmed_bookings_count": package.confirmed_bookings_count or 0,
            "agent_name": agent_name,
            "agent_email": package.agent.email,
            "agent_location": agent_location,
            "agent_rating": package.agent_rating,
            "created_at": package.created_at,
            "updated_at": package.updated_at,
        })

    recent_packages = packages[:5]
    completed_packages = [p for p in packages if p["status_key"] == PackageStatus.COMPLETED][:5]
    display_name = request.user.email.split("@")[0]

    context = {
        'user': request.user,
        'packages': packages,
        'recent_packages': recent_packages,
        'completed_packages': completed_packages,
        'total_packages': len(packages),
        'search_query': search_query,
        'filters': {
            'status': selected_status,
            'country': selected_country,
            'sort': selected_sort,
        },
        'filter_options': {
            'countries': available_countries,
        },
        'display_name': display_name,
        'package_metrics': {
            'active': status_counts[PackageStatus.ACTIVE],
            'completed': status_counts[PackageStatus.COMPLETED],
            'draft': status_counts[PackageStatus.DRAFT],
            'agents': len(unique_agent_ids),
            'joined_travelers': total_joined_travelers,
            'confirmed_bookings': total_confirmed_bookings,
        },
        'active_nav': 'packages',
    }
    return render(request, 'admin_packages.html', context)


def admin_package_detail_view(request, package_id):
    """Admin view to inspect full package details, reviews, and participants."""
    if not request.user.is_authenticated or request.user.role != Roles.ADMIN:
        messages.error(request, 'Access denied. Admin access required.')
        return redirect('login')

    try:
        package = (
            Package.objects.select_related("agent")
            .prefetch_related("features")
            .get(id=package_id)
        )
    except Package.DoesNotExist:
        messages.error(request, 'Package not found.')
        return redirect('admin_packages')

    # Agent profile and display fields
    try:
        agent_profile = AgentProfile.objects.get(user=package.agent)
        agent_name = agent_profile.full_name
        agent_location = agent_profile.location
        agent_rating = float(agent_profile.rating or 0)
        agent_profile_picture_url = agent_profile.profile_picture.url if agent_profile.profile_picture else ""
    except AgentProfile.DoesNotExist:
        agent_name = package.agent.email.split('@')[0]
        agent_location = ''
        agent_rating = 0.0
        agent_profile_picture_url = ''

    # Reviews for the package owner (agent)
    agent_reviews = AgentReview.objects.filter(agent=package.agent).order_by('-created_at')
    reviews_with_profiles = []
    for review in agent_reviews:
        try:
            profile = review.user.user_profile
            reviews_with_profiles.append({
                'review': review,
                'profile': profile,
            })
        except UserProfile.DoesNotExist:
            reviews_with_profiles.append({
                'review': review,
                'profile': None,
            })

    # Confirmed bookings (travelers joined)
    bookings = Booking.objects.filter(
        package=package,
        status=BookingStatus.CONFIRMED
    ).order_by('-created_at')
    participants = []
    total_joined_travelers = 0
    for booking in bookings:
        total_joined_travelers += int(getattr(booking, "traveler_count", 0) or 0)
        try:
            profile = booking.user.user_profile
            participants.append({
                'booking': booking,
                'profile': profile,
            })
        except UserProfile.DoesNotExist:
            participants.append({
                'booking': booking,
                'profile': None,
            })

    display_name = request.user.email.split('@')[0]

    context = {
        'user': request.user,
        'display_name': display_name,
        'package': package,
        'agent_name': agent_name,
        'agent_location': agent_location,
        'agent_rating': agent_rating,
        'agent_profile_picture_url': agent_profile_picture_url,
        'reviews': reviews_with_profiles,
        'reviews_count': agent_reviews.count(),
        'participants': participants,
        'participants_count': bookings.count(),
        'joined_travelers_total': total_joined_travelers,
        'active_nav': 'packages',
    }
    return render(request, 'admin_package_detail.html', context)


def admin_users_view(request):
    """Admin view to list all travelers and agents"""
    if not request.user.is_authenticated or request.user.role != Roles.ADMIN:
        messages.error(request, 'Access denied. Admin access required.')
        return redirect('login')

    create_agent_form = {
        'email': '',
        'first_name': '',
        'last_name': '',
        'phone_number': '',
        'location': '',
    }

    if request.method == 'POST' and request.POST.get('form_type') == 'create_agent':
        email = (request.POST.get('email') or '').strip()
        password = request.POST.get('password') or ''
        confirm_password = request.POST.get('confirm_password') or ''
        first_name = (request.POST.get('first_name') or '').strip()
        last_name = (request.POST.get('last_name') or '').strip()
        phone_number = (request.POST.get('phone_number') or '').strip()
        location = (request.POST.get('location') or '').strip()

        create_agent_form.update({
            'email': email,
            'first_name': first_name,
            'last_name': last_name,
            'phone_number': phone_number,
            'location': location,
        })

        if not email or not password or not confirm_password:
            messages.error(request, 'Email, password, and confirm password are required.')
        elif password != confirm_password:
            messages.error(request, 'Password and confirm password do not match.')
        elif len(password) < 8:
            messages.error(request, 'Password must be at least 8 characters long.')
        elif User.objects.filter(email__iexact=email).exists():
            messages.error(request, 'A user with this email already exists.')
        else:
            try:
                with transaction.atomic():
                    new_agent = User.objects.create_user(
                        email=email,
                        password=password,
                        role=Roles.AGENT,
                    )
                    AgentProfile.objects.update_or_create(
                        user=new_agent,
                        defaults={
                            'first_name': first_name,
                            'last_name': last_name,
                            'phone_number': phone_number,
                            'location': location,
                        },
                    )

                agent_name = f"{first_name} {last_name}".strip() or email.split('@')[0]
                try:
                    send_agent_credentials_email(
                        email=new_agent.email,
                        password=password,
                        login_url=request.build_absolute_uri(reverse('login')),
                        agent_name=agent_name,
                    )
                    messages.success(request, f'Agent created successfully and credentials email sent to {new_agent.email}.')
                except Exception as exc:
                    messages.warning(request, f'Agent created successfully, but email could not be sent: {exc}')

                return redirect('admin_users')
            except Exception as exc:
                messages.error(request, f'Could not create agent: {exc}')

    traveler_users = (
        User.objects.filter(role=Roles.TRAVELER)
        .select_related('user_profile')
        .annotate(
            bookings_count=Count('bookings', distinct=True),
            custom_packages_count=Count('custom_packages', distinct=True),
            reviews_written_count=Count('agent_reviews', distinct=True),
            traveler_chats_count=Count('chat_rooms_as_traveler', distinct=True),
        )
        .order_by('-date_joined')
    )
    travelers = []
    for u in traveler_users:
        try:
            profile = u.user_profile
        except UserProfile.DoesNotExist:
            profile = None
        travelers.append({
            'user': u,
            'profile': profile,
            'stats': {
                'bookings_count': getattr(u, 'bookings_count', 0),
                'custom_packages_count': getattr(u, 'custom_packages_count', 0),
                'reviews_written_count': getattr(u, 'reviews_written_count', 0),
                'chats_count': getattr(u, 'traveler_chats_count', 0),
            },
        })

    agent_users = (
        User.objects.filter(role=Roles.AGENT)
        .select_related('agent_profile')
        .annotate(
            packages_count=Count('packages', distinct=True),
            reviews_received_count=Count('reviews_received', distinct=True),
            claimed_custom_packages_count=Count('claimed_custom_packages', distinct=True),
            agent_chats_count=Count('chat_rooms_as_agent', distinct=True),
        )
        .order_by('-date_joined')
    )
    agents = []
    for u in agent_users:
        try:
            profile = u.agent_profile
        except AgentProfile.DoesNotExist:
            profile = None
        agents.append({
            'user': u,
            'profile': profile,
            'stats': {
                'packages_count': getattr(u, 'packages_count', 0),
                'reviews_received_count': getattr(u, 'reviews_received_count', 0),
                'claimed_custom_packages_count': getattr(u, 'claimed_custom_packages_count', 0),
                'chats_count': getattr(u, 'agent_chats_count', 0),
            },
        })

    context = {
        'user': request.user,
        'travelers': travelers,
        'agents': agents,
        'create_agent_form': create_agent_form,
        'active_nav': 'users',
    }
    return render(request, 'admin_users.html', context)


def admin_notifications_view(request):
    """Admin view to send notifications to agents or travelers."""
    if not request.user.is_authenticated or request.user.role != Roles.ADMIN:
        messages.error(request, 'Access denied. Admin access required.')
        return redirect('login')

    travelers = list(User.objects.filter(role=Roles.TRAVELER).select_related('user_profile').order_by('email'))
    traveler_choices = [{'id': u.id, 'email': u.email, 'name': getattr(u.user_profile, 'full_name', u.email) or u.email} for u in travelers]

    agents = list(User.objects.filter(role=Roles.AGENT).select_related('agent_profile').order_by('email'))
    agent_choices = [{'id': u.id, 'email': u.email, 'name': getattr(getattr(u, 'agent_profile', None), 'full_name', None) or u.email} for u in agents]

    if request.method == 'POST':
        title = (request.POST.get('title') or '').strip()
        message = (request.POST.get('message') or '').strip()
        notification_type = request.POST.get('notification_type') or 'general'
        audience = request.POST.get('audience') or 'travelers'
        target_type = request.POST.get('target_type') or ('all_travelers' if audience == 'travelers' else 'all_agents')
        selected_ids = request.POST.getlist('user_ids')

        if not title or not message:
            messages.error(request, 'Title and message are required.')
        else:
            if target_type == 'specific' and not selected_ids:
                label = 'agents' if audience == 'agents' else 'users'
                messages.error(request, f'Please select at least one {label[:-1]} when sending to specific {label}.')
            else:
                if audience == 'agents':
                    if target_type == 'all_agents':
                        recipients = User.objects.filter(role=Roles.AGENT)
                    else:
                        recipients = User.objects.filter(role=Roles.AGENT, id__in=selected_ids)
                else:
                    if target_type == 'all_travelers':
                        recipients = User.objects.filter(role=Roles.TRAVELER)
                    elif target_type == 'all_users':
                        recipients = User.objects.all()
                    else:
                        recipients = User.objects.filter(id__in=selected_ids, role=Roles.TRAVELER)

                if recipients.exists():
                    with transaction.atomic():
                        notification = Notification.objects.create(
                            title=title, message=message, notification_type=notification_type, sender=request.user
                        )
                        NotificationRecipient.objects.bulk_create(
                            [NotificationRecipient(notification=notification, user=u) for u in recipients]
                        )
                    recipient_ids = list(recipients.values_list("id", flat=True))
                    send_expo_push_for_notification(notification, recipient_ids)
                    messages.success(request, f'Notification sent to {recipients.count()} recipient(s).')
                    return redirect('admin_notifications')
                else:
                    messages.error(request, 'No recipients found.')

    context = {
        'user': request.user,
        'traveler_choices': traveler_choices,
        'agent_choices': agent_choices,
        'active_nav': 'notifications',
    }
    return render(request, 'admin_notifications.html', context)


def agent_notifications_view(request):
    """Agent view to send notifications to their travelers (bookings + chat contacts)."""
    if not request.user.is_authenticated or request.user.role != Roles.AGENT:
        messages.error(request, 'Access denied. Agent access required.')
        return redirect('login')

    agent = request.user
    traveler_ids = set()
    traveler_ids.update(Booking.objects.filter(package__agent=agent).values_list('user_id', flat=True))
    traveler_ids.update(ChatRoom.objects.filter(agent=agent).values_list('traveler_id', flat=True))
    my_travelers = User.objects.filter(id__in=traveler_ids, role=Roles.TRAVELER).select_related('user_profile').order_by('email')
    traveler_choices = [{'id': u.id, 'email': u.email, 'name': getattr(u.user_profile, 'full_name', u.email) or u.email} for u in my_travelers]

    if request.method == 'POST' and request.POST.get('action') == 'mark_all_read':
        NotificationRecipient.objects.filter(user=agent, notification__sender__role=Roles.ADMIN).update(is_read=True)
        messages.success(request, 'All notifications marked as read.')
        return redirect('agent_notifications')

    if request.method == 'POST':
        title = (request.POST.get('title') or '').strip()
        message = (request.POST.get('message') or '').strip()
        notification_type = request.POST.get('notification_type') or 'general'
        selected_ids = request.POST.getlist('user_ids')

        if not title or not message:
            messages.error(request, 'Title and message are required.')
        else:
            if selected_ids:
                recipients = User.objects.filter(role=Roles.TRAVELER, id__in=selected_ids).filter(id__in=traveler_ids)
            else:
                recipients = my_travelers

            if recipients.exists():
                with transaction.atomic():
                    notification = Notification.objects.create(
                        title=title, message=message, notification_type=notification_type, sender=request.user
                    )
                    NotificationRecipient.objects.bulk_create(
                        [NotificationRecipient(notification=notification, user=u) for u in recipients]
                    )
                recipient_ids = list(recipients.values_list("id", flat=True))
                send_expo_push_for_notification(notification, recipient_ids)
                messages.success(request, f'Notification sent to {recipients.count()} traveler(s).')
                return redirect('agent_notifications')
            else:
                messages.error(request, 'No travelers to notify.')

    sent_notifications = (
        Notification.objects.filter(sender=agent)
        .annotate(recipient_count=Count("recipients"))
        .select_related("sender")
        .order_by("-created_at")[:50]
    )

    received_recipients = (
        NotificationRecipient.objects.filter(user=agent)
        .filter(notification__sender__role=Roles.ADMIN)
        .select_related("notification")
        .order_by("-created_at")[:50]
    )
    received_with_read = [
        {"notification": nr.notification, "recipient_id": nr.id, "is_read": nr.is_read}
        for nr in received_recipients
    ]
    unread_count = sum(1 for r in received_with_read if not r["is_read"])

    context = {
        'user': request.user,
        'traveler_choices': traveler_choices,
        'sent_notifications': sent_notifications,
        'received_with_read': received_with_read,
        'unread_count': unread_count,
        'active_nav': 'notifications',
    }
    return render(request, 'agent_notifications.html', context)


def agent_deals_view(request):
    """Agent view to create and manage deals on their packages."""
    if not request.user.is_authenticated or request.user.role != Roles.AGENT:
        messages.error(request, 'Access denied. Agent access required.')
        return redirect('login')

    agent = request.user
    now = timezone.now()
    today = timezone.localdate()

    package_choices = list(
        Package.objects.filter(agent=agent, status=PackageStatus.ACTIVE)
        .filter(Q(trip_start_date__isnull=True) | Q(trip_start_date__gt=today))
        .order_by('title')
        .values('id', 'title', 'price_per_person')
    )

    if request.method == 'POST':
        title = (request.POST.get('title') or '').strip()
        package_id = request.POST.get('package_id')
        discount_percent = request.POST.get('discount_percent')
        valid_from_str = request.POST.get('valid_from')
        valid_until_str = request.POST.get('valid_until')

        errors = []
        if not package_id:
            errors.append('Please select a package.')
        else:
            package = Package.objects.filter(id=package_id, agent=agent).first()
            if not package:
                errors.append('Invalid package.')
            elif package.trip_start_date and package.trip_start_date <= today:
                errors.append('Cannot create a deal for a package whose trip has already started.')
        try:
            discount = int(discount_percent or 0)
            if not (1 <= discount <= 99):
                errors.append('Discount must be between 1 and 99.')
        except (TypeError, ValueError):
            errors.append('Invalid discount percentage.')
        if not valid_from_str:
            errors.append('Valid from date is required.')
        if not valid_until_str:
            errors.append('Valid until date is required.')

        # Interpret datetime-local values as app timezone (Nepal); stored as UTC
        deal_tz = ZoneInfo('Asia/Kathmandu')
        if not errors:
            try:
                s = valid_from_str.strip()
                if 'T' in s:
                    dt = datetime.strptime(s[:16], '%Y-%m-%dT%H:%M')
                else:
                    dt = datetime.strptime(s[:10], '%Y-%m-%d').replace(hour=0, minute=0, second=0)
                valid_from = dt.replace(tzinfo=deal_tz)
            except (ValueError, TypeError):
                valid_from = None
            try:
                s = valid_until_str.strip()
                if 'T' in s:
                    dt = datetime.strptime(s[:16], '%Y-%m-%dT%H:%M')
                else:
                    dt = datetime.strptime(s[:10], '%Y-%m-%d').replace(hour=23, minute=59, second=59)
                valid_until = dt.replace(tzinfo=deal_tz)
            except (ValueError, TypeError):
                valid_until = None
            if valid_from and valid_until and valid_until <= valid_from:
                errors.append('Valid until must be after valid from.')
            if not errors:
                Deal.objects.create(
                    package_id=int(package_id),
                    agent=agent,
                    title=title or '',
                    discount_percent=discount,
                    valid_from=valid_from,
                    valid_until=valid_until,
                )
                messages.success(request, 'Deal created successfully.')
                return redirect('agent_deals')

        for e in errors:
            messages.error(request, e)

    deals = Deal.objects.filter(agent=agent).select_related('package').order_by('-valid_until')
    active_deals = [d for d in deals if d.valid_from <= now <= d.valid_until]
    upcoming_deals = [d for d in deals if d.valid_from > now]
    past_deals = [d for d in deals if d.valid_until < now]

    context = {
        'user': request.user,
        'package_choices': package_choices,
        'active_deals': active_deals,
        'upcoming_deals': upcoming_deals,
        'past_deals': past_deals,
        'active_nav': 'deals',
    }
    return render(request, 'agent_deals.html', context)


def agent_dashboard_view(request):
    """Agent dashboard with actionable performance metrics and traveler insights."""
    if not request.user.is_authenticated or request.user.role != Roles.AGENT:
        messages.error(request, 'Access denied. Agent access required.')
        return redirect('login')

    _mark_overdue_packages_completed()

    now = timezone.now()
    today = timezone.localdate()
    current_month_start = today.replace(day=1)
    previous_month_start = _shift_month(current_month_start, -1)
    next_month_start = _shift_month(current_month_start, 1)
    month_starts = [_shift_month(current_month_start, offset) for offset in range(-5, 1)]
    month_labels = [m.strftime("%b") for m in month_starts]
    month_keys = [m.strftime("%Y-%m") for m in month_starts]
    start_window = month_starts[0]

    agent_profile, _ = AgentProfile.objects.get_or_create(user=request.user)
    display_name = agent_profile.full_name or request.user.email.split("@")[0]

    package_qs = Package.objects.filter(agent=request.user)
    bookings_qs = Booking.objects.filter(package__agent=request.user)
    confirmed_bookings_qs = bookings_qs.filter(status=BookingStatus.CONFIRMED)
    cancelled_bookings_qs = bookings_qs.filter(status=BookingStatus.CANCELLED)
    reviews_qs = AgentReview.objects.filter(agent=request.user)
    claimed_custom_qs = CustomPackage.objects.filter(claimed_by=request.user)
    chat_rooms_qs = ChatRoom.objects.filter(agent=request.user)
    messages_qs = ChatMessage.objects.filter(room__agent=request.user)

    total_packages = package_qs.count()
    active_packages = package_qs.filter(status=PackageStatus.ACTIVE).count()
    completed_packages = package_qs.filter(status=PackageStatus.COMPLETED).count()
    draft_packages = package_qs.filter(status=PackageStatus.DRAFT).count()
    upcoming_packages = package_qs.filter(
        status=PackageStatus.ACTIVE,
        trip_start_date__isnull=False,
        trip_start_date__gte=today,
    ).count()

    total_bookings = bookings_qs.count()
    confirmed_bookings = confirmed_bookings_qs.count()
    cancelled_bookings = cancelled_bookings_qs.count()
    travelers_served = confirmed_bookings_qs.aggregate(total=Sum("traveler_count")).get("total") or 0
    unique_travelers = confirmed_bookings_qs.values("user").distinct().count()
    estimated_revenue = confirmed_bookings_qs.aggregate(total=Sum("total_amount")).get("total") or 0
    avg_booking_value = (estimated_revenue / confirmed_bookings) if confirmed_bookings else 0

    bookings_this_month = bookings_qs.filter(
        created_at__gte=current_month_start,
        created_at__lt=next_month_start,
    ).count()
    bookings_last_month = bookings_qs.filter(
        created_at__gte=previous_month_start,
        created_at__lt=current_month_start,
    ).count()
    revenue_this_month = confirmed_bookings_qs.filter(
        created_at__gte=current_month_start,
        created_at__lt=next_month_start,
    ).aggregate(total=Sum("total_amount")).get("total") or 0
    revenue_last_month = confirmed_bookings_qs.filter(
        created_at__gte=previous_month_start,
        created_at__lt=current_month_start,
    ).aggregate(total=Sum("total_amount")).get("total") or 0

    reviews_count = reviews_qs.count()
    avg_rating = float(agent_profile.rating or 0)
    reviews_this_month = reviews_qs.filter(
        created_at__gte=current_month_start,
        created_at__lt=next_month_start,
    ).count()
    reviews_last_month = reviews_qs.filter(
        created_at__gte=previous_month_start,
        created_at__lt=current_month_start,
    ).count()
    reviews_change_pct = _pct_change(reviews_this_month, reviews_last_month)
    low_rating_reviews_30d_qs = reviews_qs.filter(
        rating__lte=3,
        created_at__gte=now - timedelta(days=30),
    )
    low_rating_reviews_30d_count = low_rating_reviews_30d_qs.count()

    active_chat_rooms = chat_rooms_qs.count()
    messages_last_30_days = messages_qs.filter(created_at__gte=now - timedelta(days=30)).count()
    unread_traveler_messages = messages_qs.filter(
        sender__role=Roles.TRAVELER,
        is_read=False,
    ).count()

    claimed_custom_total = claimed_custom_qs.count()
    claimed_custom_active = claimed_custom_qs.filter(status=CustomPackage.CustomPackageStatus.CLAIMED).count()
    claimed_custom_completed = claimed_custom_qs.filter(status=CustomPackage.CustomPackageStatus.COMPLETED).count()
    claimed_custom_cancelled = claimed_custom_qs.filter(status=CustomPackage.CustomPackageStatus.CANCELLED).count()
    marketplace_open_custom = CustomPackage.objects.filter(status=CustomPackage.CustomPackageStatus.OPEN).count()

    booking_status = [
        {
            "label": "Confirmed",
            "count": confirmed_bookings,
            "percent": _safe_pct(confirmed_bookings, total_bookings),
            "css_class": "status-confirmed",
        },
        {
            "label": "Cancelled",
            "count": cancelled_bookings,
            "percent": _safe_pct(cancelled_bookings, total_bookings),
            "css_class": "status-cancelled",
        },
    ]
    package_status = [
        {
            "label": "Active",
            "count": active_packages,
            "percent": _safe_pct(active_packages, total_packages),
            "css_class": "status-active",
        },
        {
            "label": "Completed",
            "count": completed_packages,
            "percent": _safe_pct(completed_packages, total_packages),
            "css_class": "status-completed",
        },
        {
            "label": "Draft",
            "count": draft_packages,
            "percent": _safe_pct(draft_packages, total_packages),
            "css_class": "status-draft",
        },
    ]

    review_rating_rows = list(
        reviews_qs.values("rating").annotate(count=Count("id")).order_by("-rating")
    )
    review_rating_map = {int(row["rating"]): row["count"] for row in review_rating_rows}
    review_breakdown = [
        {
            "label": f"{rating} star",
            "rating": rating,
            "count": review_rating_map.get(rating, 0),
            "percent": _safe_pct(review_rating_map.get(rating, 0), reviews_count),
        }
        for rating in range(5, 0, -1)
    ]

    booking_trend_qs = (
        confirmed_bookings_qs.filter(created_at__date__gte=start_window)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(count=Count("id"), travelers=Sum("traveler_count"))
        .order_by("month")
    )
    revenue_trend_qs = (
        confirmed_bookings_qs.filter(created_at__date__gte=start_window)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(total=Sum("total_amount"))
        .order_by("month")
    )
    booking_trend_map = {_month_key(row["month"]): row for row in booking_trend_qs}
    revenue_trend_map = {_month_key(row["month"]): (row.get("total") or 0) for row in revenue_trend_qs}

    monthly_booking_values = [int((booking_trend_map.get(key) or {}).get("count", 0) or 0) for key in month_keys]
    monthly_traveler_values = [int((booking_trend_map.get(key) or {}).get("travelers", 0) or 0) for key in month_keys]
    monthly_revenue_values = [float(revenue_trend_map.get(key, 0) or 0) for key in month_keys]

    review_trend_qs = (
        reviews_qs.filter(created_at__date__gte=start_window)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(count=Count("id"), avg_rating=Avg("rating"))
        .order_by("month")
    )
    review_trend_map = {_month_key(row["month"]): row for row in review_trend_qs}
    monthly_review_count_values = [int((review_trend_map.get(key) or {}).get("count", 0) or 0) for key in month_keys]
    monthly_review_avg_values = [float((review_trend_map.get(key) or {}).get("avg_rating", 0) or 0) for key in month_keys]

    max_bookings_bar = max(monthly_booking_values, default=0)
    max_revenue_bar = max(monthly_revenue_values, default=0)
    max_review_count_bar = max(monthly_review_count_values, default=0)
    monthly_booking_bars = [
        {
            "label": month_labels[i],
            "value": monthly_booking_values[i],
            "travelers": monthly_traveler_values[i],
            "height_pct": 0 if max_bookings_bar == 0 else (
                0 if monthly_booking_values[i] == 0 else max(14, round((monthly_booking_values[i] / max_bookings_bar) * 100))
            ),
        }
        for i in range(len(month_labels))
    ]
    monthly_revenue_bars = [
        {
            "label": month_labels[i],
            "value": round(monthly_revenue_values[i], 2),
            "height_pct": 0 if max_revenue_bar == 0 else (
                0 if monthly_revenue_values[i] == 0 else max(14, round((monthly_revenue_values[i] / max_revenue_bar) * 100))
            ),
        }
        for i in range(len(month_labels))
    ]
    monthly_review_bars = [
        {
            "label": month_labels[i],
            "value": monthly_review_count_values[i],
            "avg_rating": round(monthly_review_avg_values[i], 1) if monthly_review_count_values[i] else 0,
            "count_height_pct": 0 if max_review_count_bar == 0 else (
                0 if monthly_review_count_values[i] == 0 else max(14, round((monthly_review_count_values[i] / max_review_count_bar) * 100))
            ),
            "avg_height_pct": 0 if monthly_review_count_values[i] == 0 else max(12, round((monthly_review_avg_values[i] / 5) * 100)),
        }
        for i in range(len(month_labels))
    ]

    top_packages_qs = (
        package_qs.annotate(
            confirmed_bookings_count=Count(
                "bookings",
                filter=Q(bookings__status=BookingStatus.CONFIRMED),
                distinct=True,
            ),
            traveler_seats=Sum(
                "bookings__traveler_count",
                filter=Q(bookings__status=BookingStatus.CONFIRMED),
            ),
            estimated_revenue_amount=Sum(
                "bookings__total_amount",
                filter=Q(bookings__status=BookingStatus.CONFIRMED),
            ),
        )
        .order_by("-confirmed_bookings_count", "-estimated_revenue_amount", "-participants_count", "title")[:6]
    )
    max_top_package_bookings = max((p.confirmed_bookings_count or 0 for p in top_packages_qs), default=0)
    top_packages = [
        {
            "title": p.title,
            "location": f"{p.location}, {p.country}",
            "status": p.get_status_display(),
            "confirmed_bookings": p.confirmed_bookings_count or 0,
            "traveler_seats": p.traveler_seats or 0,
            "revenue": p.estimated_revenue_amount or 0,
            "bar_percent": _safe_pct(p.confirmed_bookings_count or 0, max_top_package_bookings) if max_top_package_bookings else 0,
        }
        for p in top_packages_qs
    ]

    recent_bookings_qs = (
        bookings_qs.select_related("user", "user__user_profile", "package")
        .order_by("-created_at")[:8]
    )
    recent_bookings = []
    for b in recent_bookings_qs:
        try:
            traveler_name = b.user.user_profile.full_name
        except UserProfile.DoesNotExist:
            traveler_name = b.user.email.split("@")[0]
        recent_bookings.append(
            {
                "traveler_name": traveler_name,
                "traveler_email": b.user.email,
                "package_title": b.package.title,
                "traveler_count": b.traveler_count or 1,
                "total_amount": b.total_amount or 0,
                "status": b.get_status_display(),
                "status_key": b.status,
                "created_at": b.created_at,
            }
        )

    top_travelers_rows = list(
        confirmed_bookings_qs.values("user", "user__email")
        .annotate(
            bookings_count=Count("id"),
            traveler_seats=Sum("traveler_count"),
            total_spend=Sum("total_amount"),
            last_booking_at=Max("created_at"),
        )
        .order_by("-bookings_count", "-total_spend", "user__email")[:6]
    )
    traveler_ids = [row["user"] for row in top_travelers_rows]
    traveler_profiles = {
        p.user_id: p for p in UserProfile.objects.filter(user_id__in=traveler_ids)
    }
    max_top_traveler_bookings = max((row["bookings_count"] for row in top_travelers_rows), default=0)
    top_travelers = []
    for row in top_travelers_rows:
        profile = traveler_profiles.get(row["user"])
        traveler_name = (profile.full_name if profile else None) or row["user__email"].split("@")[0]
        top_travelers.append(
            {
                "name": traveler_name,
                "email": row["user__email"],
                "location": (profile.location if profile else "") or "Unknown",
                "bookings_count": row["bookings_count"] or 0,
                "traveler_seats": row["traveler_seats"] or 0,
                "total_spend": row["total_spend"] or 0,
                "last_booking_at": row["last_booking_at"],
                "bar_percent": _safe_pct(row["bookings_count"] or 0, max_top_traveler_bookings) if max_top_traveler_bookings else 0,
            }
        )

    recent_reviews_qs = reviews_qs.select_related("user", "user__user_profile").order_by("-created_at")[:5]
    recent_reviews = []
    for r in recent_reviews_qs:
        try:
            reviewer_name = r.user.user_profile.full_name
        except UserProfile.DoesNotExist:
            reviewer_name = r.user.email.split("@")[0]
        recent_reviews.append(
            {
                "reviewer_name": reviewer_name,
                "rating": r.rating,
                "comment": r.comment,
                "created_at": r.created_at,
            }
        )

    low_rating_recent_reviews_qs = (
        low_rating_reviews_30d_qs.select_related("user", "user__user_profile").order_by("-created_at")[:4]
    )
    low_rating_recent_reviews = []
    for r in low_rating_recent_reviews_qs:
        try:
            reviewer_name = r.user.user_profile.full_name
        except UserProfile.DoesNotExist:
            reviewer_name = r.user.email.split("@")[0]
        low_rating_recent_reviews.append(
            {
                "reviewer_name": reviewer_name,
                "rating": r.rating,
                "comment": r.comment,
                "created_at": r.created_at,
            }
        )

    upcoming_departures_qs = (
        package_qs.filter(
            status=PackageStatus.ACTIVE,
            trip_start_date__isnull=False,
            trip_start_date__gte=today,
        )
        .annotate(
            confirmed_bookings_count=Count(
                "bookings",
                filter=Q(bookings__status=BookingStatus.CONFIRMED),
                distinct=True,
            ),
            joined_travelers=Sum(
                "bookings__traveler_count",
                filter=Q(bookings__status=BookingStatus.CONFIRMED),
            ),
        )
        .order_by("trip_start_date", "title")[:5]
    )
    upcoming_departures = [
        {
            "title": p.title,
            "trip_start_date": p.trip_start_date,
            "trip_end_date": p.trip_end_date,
            "confirmed_bookings": p.confirmed_bookings_count or 0,
            "joined_travelers": p.joined_travelers or 0,
            "location": f"{p.location}, {p.country}",
        }
        for p in upcoming_departures_qs
    ]

    booking_growth_delta = _pct_change(bookings_this_month, bookings_last_month)
    revenue_growth_delta = _pct_change(float(revenue_this_month or 0), float(revenue_last_month or 0))

    insights = []
    if booking_growth_delta > 0:
        insights.append(f"Bookings increased by {booking_growth_delta}% versus last month.")
    elif booking_growth_delta < 0:
        insights.append(f"Bookings decreased by {abs(booking_growth_delta)}% versus last month.")
    else:
        insights.append("Bookings are flat compared to last month.")

    if top_packages:
        insights.append(
            f"Top package right now is {top_packages[0]['title']} with {top_packages[0]['confirmed_bookings']} confirmed bookings."
        )
    if unread_traveler_messages:
        insights.append(f"You have {unread_traveler_messages} unread traveler messages to respond to.")
    if claimed_custom_active:
        insights.append(f"{claimed_custom_active} claimed custom request(s) are currently in progress.")
    if not insights:
        insights.append("No performance insights yet. Publish packages and engage travelers to populate this dashboard.")

    context = {
        "user": request.user,
        "display_name": display_name,
        "profile": agent_profile,
        "active_nav": "dashboard",
        "stats": {
            "total_packages": total_packages,
            "active_packages": active_packages,
            "completed_packages": completed_packages,
            "draft_packages": draft_packages,
            "upcoming_packages": upcoming_packages,
            "total_bookings": total_bookings,
            "confirmed_bookings": confirmed_bookings,
            "cancelled_bookings": cancelled_bookings,
            "travelers_served": travelers_served,
            "unique_travelers": unique_travelers,
            "estimated_revenue": estimated_revenue,
            "avg_booking_value": avg_booking_value,
            "avg_rating": avg_rating,
            "reviews_count": reviews_count,
            "reviews_this_month": reviews_this_month,
            "reviews_last_month": reviews_last_month,
            "active_chat_rooms": active_chat_rooms,
            "messages_last_30_days": messages_last_30_days,
            "unread_traveler_messages": unread_traveler_messages,
            "claimed_custom_total": claimed_custom_total,
            "claimed_custom_active": claimed_custom_active,
            "claimed_custom_completed": claimed_custom_completed,
            "claimed_custom_cancelled": claimed_custom_cancelled,
            "marketplace_open_custom": marketplace_open_custom,
            "booking_confirmation_rate": _safe_pct(confirmed_bookings, total_bookings),
            "booking_cancellation_rate": _safe_pct(cancelled_bookings, total_bookings),
            "custom_completion_rate": _safe_pct(claimed_custom_completed, claimed_custom_total),
        },
        "momentum": {
            "bookings_this_month": bookings_this_month,
            "bookings_change_pct": booking_growth_delta,
            "revenue_this_month": revenue_this_month,
            "revenue_change_pct": revenue_growth_delta,
        },
        "monthly_booking_bars": monthly_booking_bars,
        "monthly_revenue_bars": monthly_revenue_bars,
        "monthly_review_bars": monthly_review_bars,
        "package_status": package_status,
        "booking_status": booking_status,
        "review_breakdown": review_breakdown,
        "top_packages": top_packages,
        "top_travelers": top_travelers,
        "recent_bookings": recent_bookings,
        "recent_reviews": recent_reviews,
        "low_rating_recent_reviews": low_rating_recent_reviews,
        "upcoming_departures": upcoming_departures,
        "review_insights": {
            "reviews_change_pct": reviews_change_pct,
            "low_rating_reviews_30d_count": low_rating_reviews_30d_count,
            "low_rating_reviews_30d_percent": _safe_pct(low_rating_reviews_30d_count, reviews_count),
        },
        "insights": insights[:5],
    }
    return render(request, 'agent_dashboard.html', context)


def agent_reviews_view(request):
    """Agent reviews analytics page (sidebar Reviews)."""
    if not request.user.is_authenticated or request.user.role != Roles.AGENT:
        messages.error(request, 'Access denied. Agent access required.')
        return redirect('login')

    now = timezone.now()
    today = timezone.localdate()
    current_month_start = today.replace(day=1)
    previous_month_start = _shift_month(current_month_start, -1)
    next_month_start = _shift_month(current_month_start, 1)
    month_starts = [_shift_month(current_month_start, offset) for offset in range(-5, 1)]
    month_labels = [m.strftime("%b") for m in month_starts]
    month_keys = [m.strftime("%Y-%m") for m in month_starts]
    start_window = month_starts[0]

    agent_profile, _ = AgentProfile.objects.get_or_create(user=request.user)
    display_name = agent_profile.full_name or request.user.email.split("@")[0]
    reviews_qs = AgentReview.objects.filter(agent=request.user)

    reviews_count = reviews_qs.count()
    avg_rating = float(agent_profile.rating or 0)
    reviews_this_month = reviews_qs.filter(
        created_at__gte=current_month_start,
        created_at__lt=next_month_start,
    ).count()
    reviews_last_month = reviews_qs.filter(
        created_at__gte=previous_month_start,
        created_at__lt=current_month_start,
    ).count()
    reviews_change_pct = _pct_change(reviews_this_month, reviews_last_month)

    low_rating_reviews_30d_qs = reviews_qs.filter(
        rating__lte=3,
        created_at__gte=now - timedelta(days=30),
    )
    low_rating_reviews_30d_count = low_rating_reviews_30d_qs.count()

    review_rating_rows = list(
        reviews_qs.values("rating").annotate(count=Count("id")).order_by("-rating")
    )
    review_rating_map = {int(row["rating"]): row["count"] for row in review_rating_rows}
    review_breakdown = [
        {
            "rating": rating,
            "count": review_rating_map.get(rating, 0),
            "percent": _safe_pct(review_rating_map.get(rating, 0), reviews_count),
        }
        for rating in range(5, 0, -1)
    ]

    review_trend_qs = (
        reviews_qs.filter(created_at__date__gte=start_window)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(count=Count("id"), avg_rating=Avg("rating"))
        .order_by("month")
    )
    review_trend_map = {_month_key(row["month"]): row for row in review_trend_qs}
    monthly_review_count_values = [int((review_trend_map.get(key) or {}).get("count", 0) or 0) for key in month_keys]
    monthly_review_avg_values = [float((review_trend_map.get(key) or {}).get("avg_rating", 0) or 0) for key in month_keys]
    max_review_count_bar = max(monthly_review_count_values, default=0)
    monthly_review_bars = [
        {
            "label": month_labels[i],
            "value": monthly_review_count_values[i],
            "avg_rating": round(monthly_review_avg_values[i], 1) if monthly_review_count_values[i] else 0,
            "count_height_pct": 0 if max_review_count_bar == 0 else (
                0 if monthly_review_count_values[i] == 0 else max(14, round((monthly_review_count_values[i] / max_review_count_bar) * 100))
            ),
        }
        for i in range(len(month_labels))
    ]

    recent_reviews_qs = reviews_qs.select_related("user", "user__user_profile").order_by("-created_at")[:12]
    recent_reviews = []
    for r in recent_reviews_qs:
        reviewer_profile_picture_url = None
        try:
            reviewer_profile = r.user.user_profile
            reviewer_name = reviewer_profile.full_name
            if reviewer_profile.profile_picture:
                reviewer_profile_picture_url = reviewer_profile.profile_picture.url
        except UserProfile.DoesNotExist:
            reviewer_name = r.user.email.split("@")[0]
        recent_reviews.append({
            "reviewer_name": reviewer_name,
            "reviewer_profile_picture_url": reviewer_profile_picture_url,
            "rating": r.rating,
            "comment": r.comment,
            "created_at": r.created_at,
        })

    low_rating_recent_reviews_qs = (
        low_rating_reviews_30d_qs.select_related("user", "user__user_profile").order_by("-created_at")[:8]
    )
    low_rating_recent_reviews = []
    for r in low_rating_recent_reviews_qs:
        try:
            reviewer_name = r.user.user_profile.full_name
        except UserProfile.DoesNotExist:
            reviewer_name = r.user.email.split("@")[0]
        low_rating_recent_reviews.append({
            "reviewer_name": reviewer_name,
            "rating": r.rating,
            "comment": r.comment,
            "created_at": r.created_at,
        })

    context = {
        "user": request.user,
        "profile": agent_profile,
        "display_name": display_name,
        "active_nav": "reviews",
        "review_stats": {
            "avg_rating": avg_rating,
            "reviews_count": reviews_count,
            "reviews_this_month": reviews_this_month,
            "reviews_last_month": reviews_last_month,
            "reviews_change_pct": reviews_change_pct,
            "low_rating_reviews_30d_count": low_rating_reviews_30d_count,
            "low_rating_reviews_30d_percent": _safe_pct(low_rating_reviews_30d_count, reviews_count),
        },
        "review_breakdown": review_breakdown,
        "monthly_review_bars": monthly_review_bars,
        "recent_reviews": recent_reviews,
        "low_rating_recent_reviews": low_rating_recent_reviews,
        "star_slots": [1, 2, 3, 4, 5],
    }
    return render(request, 'agent_reviews.html', context)


@csrf_exempt
def logout_view(request):
    """Unified logout view for admin and agent. CSRF exempt to avoid token mismatch after long sessions."""
    if request.user.is_authenticated:
        logout(request)
        messages.success(request, 'You have been successfully logged out.')
    return redirect('login')


def agent_profile_view(request):
    """Agent profile management view"""
    if not request.user.is_authenticated or request.user.role != Roles.AGENT:
        messages.error(request, 'Access denied. Agent access required.')
        return redirect('login')
    
    # Get or create agent profile (creates in DB if not exists)
    profile, created = AgentProfile.objects.get_or_create(user=request.user)
    
    if request.method == 'POST':
        # Update profile fields (simplified set)
        profile.first_name = request.POST.get('first_name', '').strip()
        profile.last_name = request.POST.get('last_name', '').strip()
        profile.phone_number = request.POST.get('phone_number', '').strip()
        profile.location = request.POST.get('location', '').strip()
        
        # Handle profile picture: new upload
        if 'profile_picture' in request.FILES:
            profile.profile_picture = request.FILES['profile_picture']
        
        # Handle profile picture: remove
        if request.POST.get('remove_profile_picture') == '1':
            if profile.profile_picture:
                profile.profile_picture.delete(save=False)
            profile.profile_picture = None
        
        try:
            profile.save()
            messages.success(request, 'Profile updated successfully!')
            return redirect('agent_profile')
        except Exception as e:
            messages.error(request, f'Error updating profile: {str(e)}')
    
    context = {
        'user': request.user,
        'profile': profile,
        'active_nav': 'profile',
    }
    return render(request, 'agent_profile.html', context)


def agent_travelers_view(request):
    """View to list all travelers for the agent"""
    if not request.user.is_authenticated or request.user.role != Roles.AGENT:
        messages.error(request, 'Access denied. Agent access required.')
        return redirect('login')

    users = User.objects.filter(role=Roles.TRAVELER).order_by('-date_joined')
    travelers = []
    for user in users:
        try:
            profile = user.user_profile
        except UserProfile.DoesNotExist:
            profile = None
        travelers.append({'user': user, 'profile': profile})

    try:
        agent_profile = AgentProfile.objects.get(user=request.user)
        display_name = agent_profile.full_name
    except AgentProfile.DoesNotExist:
        display_name = request.user.email.split('@')[0]

    context = {
        'user': request.user,
        'display_name': display_name,
        'travelers': travelers,
        'active_nav': 'travelers',
    }
    return render(request, 'agent_travelers.html', context)


def agent_bookings_view(request):
    """List all bookings for the agent's packages with optional filters and stats."""
    if not request.user.is_authenticated or request.user.role != Roles.AGENT:
        messages.error(request, 'Access denied. Agent access required.')
        return redirect('login')

    queryset = (
        Booking.objects.filter(package__agent=request.user)
        .select_related('package', 'user')
        .order_by('-created_at')
    )

    # Filters
    status_filter = request.GET.get('status', '').strip()
    if status_filter and status_filter in dict(BookingStatus.choices):
        queryset = queryset.filter(status=status_filter)
    package_id_filter = request.GET.get('package', '').strip()
    if package_id_filter:
        try:
            pid = int(package_id_filter)
            queryset = queryset.filter(package_id=pid)
        except ValueError:
            pass

    # Build list with profile for each booking's user
    bookings_with_profile = []
    for booking in queryset:
        try:
            profile = booking.user.user_profile
        except UserProfile.DoesNotExist:
            profile = None
        bookings_with_profile.append({
            'booking': booking,
            'profile': profile,
        })

    # Stats (from unfiltered queryset for accurate totals when filtered)
    all_agent_bookings = Booking.objects.filter(package__agent=request.user)
    total_count = all_agent_bookings.count()
    confirmed_count = all_agent_bookings.filter(status=BookingStatus.CONFIRMED).count()
    cancelled_count = all_agent_bookings.filter(status=BookingStatus.CANCELLED).count()

    # Agent's packages for filter dropdown
    agent_packages = Package.objects.filter(agent=request.user).order_by('title')

    try:
        agent_profile = AgentProfile.objects.get(user=request.user)
        display_name = agent_profile.full_name
    except AgentProfile.DoesNotExist:
        display_name = request.user.email.split('@')[0]

    context = {
        'user': request.user,
        'display_name': display_name,
        'bookings_with_profile': bookings_with_profile,
        'agent_packages': agent_packages,
        'total_count': total_count,
        'confirmed_count': confirmed_count,
        'cancelled_count': cancelled_count,
        'status_filter': status_filter,
        'package_id_filter': package_id_filter,
        'booking_status_choices': BookingStatus.choices,
        'active_nav': 'bookings',
    }
    return render(request, 'agent_bookings.html', context)


def agent_chat_view(request):
    """Agent Traveler Chat UI – real-time chat with WebSocket and REST API."""
    if not request.user.is_authenticated or request.user.role != Roles.AGENT:
        messages.error(request, 'Access denied. Agent access required.')
        return redirect('login')
    try:
        agent_profile = AgentProfile.objects.get(user=request.user)
        display_name = agent_profile.full_name
    except AgentProfile.DoesNotExist:
        display_name = request.user.email.split('@')[0]

    # Build WebSocket URL from current request (ws or wss)
    ws_scheme = 'wss' if request.is_secure() else 'ws'
    ws_host = request.get_host()
    ws_base = f'{ws_scheme}://{ws_host}'

    context = {
        'user': request.user,
        'display_name': display_name,
        'active_nav': 'chat',
        'ws_base': ws_base,
        'api_base': request.build_absolute_uri('/api/auth/').rstrip('/'),
        'agent_cp_detail_url_template': reverse('agent_custom_package_detail', args=[0]),
    }
    return render(request, 'agent_chat.html', context)


# Forgot Password Views
def admin_forgot_password_view(request):
    """Handle admin forgot password request"""
    if request.method == 'POST':
        email = request.POST.get('email', '').strip()
        
        if not email:
            messages.error(request, 'Please enter your email address.')
            return render(request, 'admin_forgot_password.html')
        
        try:
            user = User.objects.get(email=email, role=Roles.ADMIN)
            
            # Generate OTP
            otp = generate_otp()
            expires_at = int(time.time()) + (5 * 60)  # 5 minutes from now
            
            # Store OTP in session
            request.session['admin_reset_otp'] = otp
            request.session['admin_reset_email'] = email
            request.session['admin_reset_expires'] = expires_at
            
            # Send OTP email
            try:
                send_otp_email(email, otp)
                messages.success(request, 'OTP has been sent to your email. Please check your inbox.')
                return redirect('admin_verify_otp')
            except Exception as e:
                messages.error(request, f'Failed to send OTP email: {str(e)}')
                return render(request, 'admin_forgot_password.html')
                
        except User.DoesNotExist:
            # Don't reveal if email exists or not for security
            messages.info(request, 'If this email exists, an OTP will be sent to your inbox.')
            return render(request, 'admin_forgot_password.html')
    
    return render(request, 'admin_forgot_password.html')


def agent_forgot_password_view(request):
    """Handle agent forgot password request"""
    if request.method == 'POST':
        email = request.POST.get('email', '').strip()
        
        if not email:
            messages.error(request, 'Please enter your email address.')
            return render(request, 'agent_forgot_password.html')
        
        try:
            user = User.objects.get(email=email, role=Roles.AGENT)
            
            # Generate OTP
            otp = generate_otp()
            expires_at = int(time.time()) + (5 * 60)  # 5 minutes from now
            
            # Store OTP in session
            request.session['agent_reset_otp'] = otp
            request.session['agent_reset_email'] = email
            request.session['agent_reset_expires'] = expires_at
            
            # Send OTP email
            try:
                send_otp_email(email, otp)
                messages.success(request, 'OTP has been sent to your email. Please check your inbox.')
                return redirect('agent_verify_otp')
            except Exception as e:
                messages.error(request, f'Failed to send OTP email: {str(e)}')
                return render(request, 'agent_forgot_password.html')
                
        except User.DoesNotExist:
            # Don't reveal if email exists or not for security
            messages.info(request, 'If this email exists, an OTP will be sent to your inbox.')
            return render(request, 'agent_forgot_password.html')
    
    return render(request, 'agent_forgot_password.html')


def admin_verify_otp_view(request):
    """Verify OTP for admin password reset"""
    email = request.session.get('admin_reset_email')
    stored_otp = request.session.get('admin_reset_otp')
    expires_at = request.session.get('admin_reset_expires')
    
    if not all([email, stored_otp, expires_at]):
        messages.error(request, 'OTP session expired. Please request a new OTP.')
        return redirect('admin_forgot_password')
    
    if int(time.time()) > expires_at:
        messages.error(request, 'OTP has expired. Please request a new one.')
        # Clear session
        request.session.pop('admin_reset_otp', None)
        request.session.pop('admin_reset_email', None)
        request.session.pop('admin_reset_expires', None)
        return redirect('admin_forgot_password')
    
    if request.method == 'POST':
        entered_otp = request.POST.get('otp', '').strip()
        
        if entered_otp == stored_otp:
            # OTP verified, allow password reset
            messages.success(request, 'OTP verified successfully. Please set your new password.')
            return redirect('admin_reset_password')
        else:
            messages.error(request, 'Invalid OTP. Please try again.')
    
    return render(request, 'admin_verify_otp.html', {'email': email})


def agent_verify_otp_view(request):
    """Verify OTP for agent password reset"""
    email = request.session.get('agent_reset_email')
    stored_otp = request.session.get('agent_reset_otp')
    expires_at = request.session.get('agent_reset_expires')
    
    if not all([email, stored_otp, expires_at]):
        messages.error(request, 'OTP session expired. Please request a new OTP.')
        return redirect('agent_forgot_password')
    
    if int(time.time()) > expires_at:
        messages.error(request, 'OTP has expired. Please request a new one.')
        # Clear session
        request.session.pop('agent_reset_otp', None)
        request.session.pop('agent_reset_email', None)
        request.session.pop('agent_reset_expires', None)
        return redirect('agent_forgot_password')
    
    if request.method == 'POST':
        entered_otp = request.POST.get('otp', '').strip()
        
        if entered_otp == stored_otp:
            # OTP verified, allow password reset
            messages.success(request, 'OTP verified successfully. Please set your new password.')
            return redirect('agent_reset_password')
        else:
            messages.error(request, 'Invalid OTP. Please try again.')
    
    return render(request, 'agent_verify_otp.html', {'email': email})


def admin_reset_password_view(request):
    """Reset password for admin"""
    email = request.session.get('admin_reset_email')
    
    if not email:
        messages.error(request, 'Session expired. Please start the password reset process again.')
        return redirect('admin_forgot_password')
    
    if request.method == 'POST':
        password = request.POST.get('password', '').strip()
        confirm_password = request.POST.get('confirm_password', '').strip()
        
        if not password or not confirm_password:
            messages.error(request, 'Please fill in all fields.')
            return render(request, 'admin_reset_password.html', {'email': email})
        
        if password != confirm_password:
            messages.error(request, 'Passwords do not match.')
            return render(request, 'admin_reset_password.html', {'email': email})
        
        if len(password) < 8:
            messages.error(request, 'Password must be at least 8 characters long.')
            return render(request, 'admin_reset_password.html', {'email': email})
        
        try:
            user = User.objects.get(email=email, role=Roles.ADMIN)
            user.set_password(password)
            user.save()
            
            # Clear session
            request.session.pop('admin_reset_otp', None)
            request.session.pop('admin_reset_email', None)
            request.session.pop('admin_reset_expires', None)
            
            messages.success(request, 'Password reset successfully. Please login with your new password.')
            return redirect('login')
        except User.DoesNotExist:
            messages.error(request, 'User not found.')
            return redirect('admin_forgot_password')
    
    return render(request, 'admin_reset_password.html', {'email': email})


def agent_reset_password_view(request):
    """Reset password for agent"""
    email = request.session.get('agent_reset_email')
    
    if not email:
        messages.error(request, 'Session expired. Please start the password reset process again.')
        return redirect('agent_forgot_password')
    
    if request.method == 'POST':
        password = request.POST.get('password', '').strip()
        confirm_password = request.POST.get('confirm_password', '').strip()
        
        if not password or not confirm_password:
            messages.error(request, 'Please fill in all fields.')
            return render(request, 'agent_reset_password.html', {'email': email})
        
        if password != confirm_password:
            messages.error(request, 'Passwords do not match.')
            return render(request, 'agent_reset_password.html', {'email': email})
        
        if len(password) < 8:
            messages.error(request, 'Password must be at least 8 characters long.')
            return render(request, 'agent_reset_password.html', {'email': email})
        
        try:
            user = User.objects.get(email=email, role=Roles.AGENT)
            user.set_password(password)
            user.save()
            
            # Clear session
            request.session.pop('agent_reset_otp', None)
            request.session.pop('agent_reset_email', None)
            request.session.pop('agent_reset_expires', None)
            
            messages.success(request, 'Password reset successfully. Please login with your new password.')
            return redirect('login')
        except User.DoesNotExist:
            messages.error(request, 'User not found.')
            return redirect('agent_forgot_password')
    
    return render(request, 'agent_reset_password.html', {'email': email})


# Profile Management Views
def ensure_rewards_awarded_for_user(user):
    """For travelers: award points (10% of booking total) for confirmed bookings on completed packages that haven't been rewarded yet."""
    if user.role != Roles.TRAVELER:
        return
    # Mark overdue packages as completed first (so we don't miss rewards for packages that haven't been loaded recently)
    _mark_overdue_packages_completed()
    # Use reward_points_given as source of truth - prevents double-award even if admin unchecks rewards_awarded
    unrewarded = Booking.objects.filter(
        user=user,
        status=BookingStatus.CONFIRMED,
        reward_points_given=0,
        package__status=PackageStatus.COMPLETED,
    ).select_related("user__user_profile")
    for booking in unrewarded:
        amount = float(booking.total_amount or 0)
        if amount <= 0:
            amount = float(booking.price_per_person_snapshot or 0) * (booking.traveler_count or 1)
        points = int(amount * 0.10)  # 10% of booking total
        profile = booking.user.user_profile
        profile.reward_points = (profile.reward_points or 0) + points
        profile.save(update_fields=["reward_points", "updated_at"])
        booking.rewards_awarded = True
        booking.reward_points_given = points
        booking.save(update_fields=["rewards_awarded", "reward_points_given"])


class UserProfileView(generics.RetrieveUpdateAPIView):
    """View for retrieving and updating user (traveler) profile"""
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsTraveler]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        profile, created = UserProfile.objects.get_or_create(user=self.request.user)
        return profile

    def retrieve(self, request, *args, **kwargs):
        ensure_rewards_awarded_for_user(request.user)
        return super().retrieve(request, *args, **kwargs)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class AgentProfileView(generics.RetrieveUpdateAPIView):
    """View for retrieving and updating agent profile"""
    serializer_class = AgentProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsAgent]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        profile, created = AgentProfile.objects.get_or_create(user=self.request.user)
        return profile

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class LeaderboardView(generics.ListAPIView):
    """List travelers ordered by reward points descending (highest first)."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get_queryset(self):
        return (
            UserProfile.objects.filter(user__role=Roles.TRAVELER)
            .select_related("user")
            .order_by("-reward_points", "id")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


class ProfileView(generics.RetrieveUpdateAPIView):
    """Universal profile view that returns the appropriate profile based on user role"""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def retrieve(self, request, *args, **kwargs):
        if request.user.role == Roles.TRAVELER:
            ensure_rewards_awarded_for_user(request.user)
        return super().retrieve(request, *args, **kwargs)

    def get_serializer_class(self):
        if self.request.user.role == Roles.AGENT:
            return AgentProfileSerializer
        elif self.request.user.role == Roles.TRAVELER:
            return UserProfileSerializer
        else:
            # Admin or other roles - return basic user info
            return UserSerializer

    def get_object(self):
        user = self.request.user
        if user.role == Roles.AGENT:
            profile, created = AgentProfile.objects.get_or_create(user=user)
            return profile
        elif user.role == Roles.TRAVELER:
            profile, created = UserProfile.objects.get_or_create(user=user)
            return profile
        else:
            return user

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


# Package Management Views
def agent_packages_view(request):
    """View to list all packages for the agent"""
    if not request.user.is_authenticated or request.user.role != Roles.AGENT:
        messages.error(request, 'Access denied. Agent access required.')
        return redirect('login')
    
    # Trip Packages: only active and draft (exclude completed)
    packages = Package.objects.filter(agent=request.user).exclude(
        status=PackageStatus.COMPLETED
    ).order_by('-created_at')
    
    # Search by title, location, or country
    search_query = request.GET.get('q', '').strip()
    if search_query:
        packages = packages.filter(
            Q(title__icontains=search_query)
            | Q(location__icontains=search_query)
            | Q(country__icontains=search_query)
        )
    
    recent_packages = Package.objects.filter(agent=request.user).exclude(
        status=PackageStatus.COMPLETED
    ).order_by('-created_at')[:7]
    completed_packages = Package.objects.filter(
        agent=request.user, status=PackageStatus.COMPLETED
    ).order_by('-updated_at')[:4]
    
    # Get agent profile for display name
    try:
        agent_profile = AgentProfile.objects.get(user=request.user)
        display_name = agent_profile.full_name
    except AgentProfile.DoesNotExist:
        display_name = request.user.email.split('@')[0]
    
    context = {
        'user': request.user,
        'display_name': display_name,
        'packages': packages,
        'recent_packages': recent_packages,
        'completed_packages': completed_packages,
        'active_nav': 'packages',
        'search_query': search_query,
    }
    return render(request, 'agent_packages.html', context)


def agent_calendar_view(request):
    """Calendar view: see which dates have trip packages and switch months."""
    if not request.user.is_authenticated or request.user.role != Roles.AGENT:
        messages.error(request, 'Access denied. Agent access required.')
        return redirect('login')

    packages_with_dates = Package.objects.filter(agent=request.user).filter(
        Q(trip_start_date__isnull=False) | Q(trip_end_date__isnull=False)
    ).order_by('trip_start_date')

    packages_for_calendar = []
    for p in packages_with_dates:
        start = p.trip_start_date.isoformat() if p.trip_start_date else None
        end = p.trip_end_date.isoformat() if p.trip_end_date else None
        packages_for_calendar.append({
            'id': p.id,
            'title': p.title,
            'location': p.location,
            'country': p.country,
            'trip_start_date': start,
            'trip_end_date': end,
            'detail_url': reverse('agent_package_detail', args=[p.id]),
            'status': p.status,
        })

    try:
        agent_profile = AgentProfile.objects.get(user=request.user)
        display_name = agent_profile.full_name
    except AgentProfile.DoesNotExist:
        display_name = request.user.email.split('@')[0]

    context = {
        'user': request.user,
        'display_name': display_name,
        'packages_for_calendar': packages_for_calendar,
        'active_nav': 'calendar',
    }
    return render(request, 'agent_calendar.html', context)


def agent_custom_packages_view(request):
    """View to list custom packages created by travelers (for the agent to see)."""
    if not request.user.is_authenticated or request.user.role != Roles.AGENT:
        messages.error(request, 'Access denied. Agent access required.')
        return redirect('login')

    qs = CustomPackage.objects.filter(user__role=Roles.TRAVELER).prefetch_related('features')

    # Filters from GET
    status_filter = request.GET.get('status', '').strip().lower()
    date_from_str = request.GET.get('date_from', '').strip()
    date_to_str = request.GET.get('date_to', '').strip()
    budget_min_str = request.GET.get('budget_min', '').strip()
    budget_max_str = request.GET.get('budget_max', '').strip()

    if status_filter and status_filter in ('open', 'claimed', 'completed', 'cancelled'):
        qs = qs.filter(status=status_filter)

    if date_from_str or date_to_str:
        date_from = None
        date_to = None
        if date_from_str:
            try:
                date_from = datetime.strptime(date_from_str, '%Y-%m-%d').date()
            except ValueError:
                pass
        if date_to_str:
            try:
                date_to = datetime.strptime(date_to_str, '%Y-%m-%d').date()
            except ValueError:
                pass
        if date_from is not None and date_to is not None:
            qs = qs.filter(
                Q(trip_start_date__gte=date_from, trip_start_date__lte=date_to) |
                Q(trip_start_date__isnull=True)
            )
        elif date_from is not None:
            qs = qs.filter(Q(trip_start_date__gte=date_from) | Q(trip_start_date__isnull=True))
        elif date_to is not None:
            qs = qs.filter(Q(trip_start_date__lte=date_to) | Q(trip_start_date__isnull=True))

    if budget_min_str:
        try:
            budget_min = float(budget_min_str)
            if budget_min >= 0:
                qs = qs.filter(price_per_person__gte=budget_min)
        except (ValueError, TypeError):
            pass

    if budget_max_str:
        try:
            budget_max = float(budget_max_str)
            if budget_max >= 0:
                qs = qs.filter(price_per_person__lte=budget_max)
        except (ValueError, TypeError):
            pass

    custom_packages = qs.order_by('-created_at')

    try:
        agent_profile = AgentProfile.objects.get(user=request.user)
        display_name = agent_profile.full_name
    except AgentProfile.DoesNotExist:
        display_name = request.user.email.split('@')[0]

    context = {
        'user': request.user,
        'display_name': display_name,
        'custom_packages': custom_packages,
        'active_nav': 'custom_package',
        'filter_status': status_filter,
        'filter_date_from': date_from_str,
        'filter_date_to': date_to_str,
        'filter_budget_min': budget_min_str,
        'filter_budget_max': budget_max_str,
    }
    return render(request, 'agent_custom_packages.html', context)


def agent_custom_package_detail_view(request, pk):
    """View full details of a traveler's custom package (for the agent)."""
    if not request.user.is_authenticated or request.user.role != Roles.AGENT:
        messages.error(request, 'Access denied. Agent access required.')
        return redirect('login')

    try:
        custom_package = CustomPackage.objects.filter(user__role=Roles.TRAVELER).prefetch_related(
            'features'
        ).get(pk=pk)
    except CustomPackage.DoesNotExist:
        messages.error(request, 'Custom package not found.')
        return redirect('agent_custom_packages')

    try:
        agent_profile = AgentProfile.objects.get(user=request.user)
        display_name = agent_profile.full_name
    except AgentProfile.DoesNotExist:
        display_name = request.user.email.split('@')[0]

    context = {
        'user': request.user,
        'display_name': display_name,
        'custom_package': custom_package,
        'active_nav': 'custom_package',
    }
    return render(request, 'agent_custom_package_detail.html', context)


def agent_add_package_view(request):
    """View to add a new package"""
    if not request.user.is_authenticated or request.user.role != Roles.AGENT:
        messages.error(request, 'Access denied. Agent access required.')
        return redirect('login')
    
    if request.method == 'POST':
        try:
            trip_start = request.POST.get('trip_start_date', '').strip() or None
            trip_end = request.POST.get('trip_end_date', '').strip() or None
            if trip_start:
                try:
                    trip_start = datetime.strptime(trip_start, '%Y-%m-%d').date()
                except ValueError:
                    trip_start = None
            if trip_end:
                try:
                    trip_end = datetime.strptime(trip_end, '%Y-%m-%d').date()
                except ValueError:
                    trip_end = None
            package = Package.objects.create(
                agent=request.user,
                title=request.POST.get('title', '').strip(),
                location=request.POST.get('location', '').strip(),
                country=request.POST.get('country', '').strip(),
                description=request.POST.get('description', '').strip(),
                price_per_person=request.POST.get('price_per_person', 0),
                duration_days=int(request.POST.get('duration_days', 7)),
                duration_nights=int(request.POST.get('duration_nights', 6)),
                trip_start_date=trip_start,
                trip_end_date=trip_end,
                status=request.POST.get('status', PackageStatus.ACTIVE)
            )
            
            # Handle image upload
            if 'main_image' in request.FILES:
                package.main_image = request.FILES['main_image']
                package.save()
            
            # Handle features - create PackageFeature objects on-the-fly (with Ionicons icon for frontend)
            feature_names = request.POST.getlist('feature_names[]')
            feature_objects = []
            for feature_name in feature_names:
                feature_name = feature_name.strip()
                if feature_name:
                    icon = get_feature_icon(feature_name)
                    feature, created = PackageFeature.objects.get_or_create(
                        name=feature_name,
                        defaults={'icon': icon}
                    )
                    if not created and (not feature.icon or feature.icon == '✓'):
                        feature.icon = icon
                        feature.save(update_fields=['icon'])
                    feature_objects.append(feature)
            
            if feature_objects:
                package.features.set(feature_objects)
            
            messages.success(request, 'Package created successfully!')
            return redirect('agent_packages')
        except Exception as e:
            messages.error(request, f'Error creating package: {str(e)}')
    
    context = {
        'user': request.user,
        'status_choices': PackageStatus.choices,
        'active_nav': 'packages',
        'feature_options': get_all_feature_options(),
    }
    return render(request, 'agent_add_package.html', context)


def agent_edit_package_view(request, package_id):
    """View to edit an existing package"""
    if not request.user.is_authenticated or request.user.role != Roles.AGENT:
        messages.error(request, 'Access denied. Agent access required.')
        return redirect('login')
    
    try:
        package = Package.objects.get(id=package_id, agent=request.user)
    except Package.DoesNotExist:
        messages.error(request, 'Package not found.')
        return redirect('agent_packages')
    
    if request.method == 'POST':
        try:
            package.title = request.POST.get('title', '').strip()
            package.location = request.POST.get('location', '').strip()
            package.country = request.POST.get('country', '').strip()
            package.description = request.POST.get('description', '').strip()
            package.price_per_person = request.POST.get('price_per_person', 0)
            package.duration_days = int(request.POST.get('duration_days', 7))
            package.duration_nights = int(request.POST.get('duration_nights', 6))
            package.status = request.POST.get('status', PackageStatus.ACTIVE)
            trip_start = request.POST.get('trip_start_date', '').strip() or None
            trip_end = request.POST.get('trip_end_date', '').strip() or None
            if trip_start:
                try:
                    package.trip_start_date = datetime.strptime(trip_start, '%Y-%m-%d').date()
                except ValueError:
                    package.trip_start_date = None
            else:
                package.trip_start_date = None
            if trip_end:
                try:
                    package.trip_end_date = datetime.strptime(trip_end, '%Y-%m-%d').date()
                except ValueError:
                    package.trip_end_date = None
            else:
                package.trip_end_date = None
            # Handle image upload
            if 'main_image' in request.FILES:
                package.main_image = request.FILES['main_image']
            
            package.save()
            
            # Handle features - create PackageFeature objects on-the-fly (with Ionicons icon for frontend)
            feature_names = request.POST.getlist('feature_names[]')
            feature_objects = []
            for feature_name in feature_names:
                feature_name = feature_name.strip()
                if feature_name:
                    icon = get_feature_icon(feature_name)
                    feature, created = PackageFeature.objects.get_or_create(
                        name=feature_name,
                        defaults={'icon': icon}
                    )
                    if not created and (not feature.icon or feature.icon == '✓'):
                        feature.icon = icon
                        feature.save(update_fields=['icon'])
                    feature_objects.append(feature)
            
            package.features.set(feature_objects)
            
            messages.success(request, 'Package updated successfully!')
            return redirect('agent_packages')
        except Exception as e:
            messages.error(request, f'Error updating package: {str(e)}')
    
    context = {
        'user': request.user,
        'package': package,
        'status_choices': PackageStatus.choices,
        'existing_features': package.features.all(),
        'feature_options': get_all_feature_options(),
        'active_nav': 'packages',
    }
    return render(request, 'agent_edit_package.html', context)


def agent_delete_package_view(request, package_id):
    """View to delete a package"""
    if not request.user.is_authenticated or request.user.role != Roles.AGENT:
        messages.error(request, 'Access denied. Agent access required.')
        return redirect('login')
    
    try:
        package = Package.objects.get(id=package_id, agent=request.user)
        package.delete()
        messages.success(request, 'Package deleted successfully!')
    except Package.DoesNotExist:
        messages.error(request, 'Package not found.')
    
    return redirect('agent_packages')


def agent_package_detail_view(request, package_id):
    """View to show package details including reviews and participants"""
    if not request.user.is_authenticated or request.user.role != Roles.AGENT:
        messages.error(request, 'Access denied. Agent access required.')
        return redirect('login')
    
    try:
        package = Package.objects.get(id=package_id, agent=request.user)
    except Package.DoesNotExist:
        messages.error(request, 'Package not found.')
        return redirect('agent_packages')
    
    # Get agent reviews (reviews for the package's agent)
    agent_reviews = AgentReview.objects.filter(agent=package.agent).order_by('-created_at')
    reviews_with_profiles = []
    for review in agent_reviews:
        try:
            profile = review.user.user_profile
            reviews_with_profiles.append({
                'review': review,
                'profile': profile,
            })
        except UserProfile.DoesNotExist:
            reviews_with_profiles.append({
                'review': review,
                'profile': None,
            })
    
    # Get confirmed bookings (participants)
    bookings = Booking.objects.filter(
        package=package,
        status=BookingStatus.CONFIRMED
    ).order_by('-created_at')
    participants = []
    for booking in bookings:
        try:
            profile = booking.user.user_profile
            participants.append({
                'booking': booking,
                'profile': profile,
            })
        except UserProfile.DoesNotExist:
            participants.append({
                'booking': booking,
                'profile': None,
            })
    
    # Get agent profile for display name and rating
    try:
        agent_profile = AgentProfile.objects.get(user=request.user)
        display_name = agent_profile.full_name
    except AgentProfile.DoesNotExist:
        display_name = request.user.email.split('@')[0]

    # Agent rating for package's agent (for template fallback)
    try:
        package_agent_profile = AgentProfile.objects.get(user=package.agent)
        agent_rating = float(package_agent_profile.rating)
    except AgentProfile.DoesNotExist:
        agent_rating = 0.0

    context = {
        'user': request.user,
        'display_name': display_name,
        'package': package,
        'reviews': reviews_with_profiles,
        'reviews_count': agent_reviews.count(),
        'participants': participants,
        'participants_count': bookings.count(),
        'agent_rating': agent_rating,
        'active_nav': 'packages',
    }
    return render(request, 'agent_package_detail.html', context)


# API Views for Packages
def _mark_overdue_packages_completed():
    """Set status to COMPLETED for packages whose trip_end_date has passed. Called before listing/detail so home only shows active."""
    Package.objects.filter(
        status=PackageStatus.ACTIVE,
        trip_end_date__isnull=False,
        trip_end_date__lt=date.today(),
    ).update(status=PackageStatus.COMPLETED)


class PackageListView(generics.ListAPIView):
    """API view to list all active packages. Packages with trip_end_date in the past are auto-marked completed and excluded."""
    serializer_class = PackageSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        _mark_overdue_packages_completed()
        queryset = Package.objects.filter(status=PackageStatus.ACTIVE).order_by('-created_at')
        # Optional filters
        location = self.request.query_params.get('location', None)
        country = self.request.query_params.get('country', None)
        date_str = self.request.query_params.get('date', None)
        
        if location:
            queryset = queryset.filter(location__icontains=location)
        if country:
            queryset = queryset.filter(country__icontains=country)
        if date_str:
            try:
                filter_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                # Packages where the given date falls within [trip_start_date, trip_end_date]
                queryset = queryset.filter(
                    trip_start_date__isnull=False,
                    trip_start_date__lte=filter_date,
                ).filter(
                    Q(trip_end_date__gte=filter_date) | Q(trip_end_date__isnull=True)
                )
            except ValueError:
                pass
        return queryset
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class PackageDetailView(generics.RetrieveAPIView):
    """API view to get package details with reviews and participants. Marks package completed if trip_end_date has passed."""
    serializer_class = PackageDetailSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Package.objects.all()  # Allow viewing completed packages too for detail
    lookup_field = 'id'

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if (
            instance.status == PackageStatus.ACTIVE
            and instance.trip_end_date
            and instance.trip_end_date < date.today()
        ):
            instance.status = PackageStatus.COMPLETED
            instance.save(update_fields=["status", "updated_at"])
        return super().retrieve(request, *args, **kwargs)
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        if (
            self.request.user.is_authenticated
            and getattr(self.request.user, "role", None) == Roles.TRAVELER
        ):
            context["bookmarked_package_ids"] = set(
                PackageBookmark.objects.filter(user=self.request.user).values_list("package_id", flat=True)
            )
        return context


class TravelerBookmarkListCreateView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated, IsTraveler]
    serializer_class = PackageSerializer

    def get(self, request, *args, **kwargs):
        _mark_overdue_packages_completed()
        queryset = (
            Package.objects.filter(bookmarks__user=request.user)
            .order_by("-bookmarks__created_at", "-created_at")
            .distinct()
        )
        context = self.get_serializer_context()
        context["bookmarked_package_ids"] = set(queryset.values_list("id", flat=True))
        serializer = self.get_serializer(queryset, many=True, context=context)
        return response.Response(serializer.data)

    def post(self, request, *args, **kwargs):
        package_id = request.data.get("package_id")
        if not package_id:
            return response.Response(
                {"package_id": "package_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        package = get_object_or_404(Package, pk=package_id)
        _, created = PackageBookmark.objects.get_or_create(user=request.user, package=package)
        return response.Response(
            {"bookmarked": True, "created": created, "package_id": package.id},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class TravelerBookmarkDeleteView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated, IsTraveler]

    def delete(self, request, package_id, *args, **kwargs):
        deleted, _ = PackageBookmark.objects.filter(user=request.user, package_id=package_id).delete()
        return response.Response(
            {"bookmarked": False, "removed": bool(deleted), "package_id": package_id}
        )


class AgentReviewListCreateView(generics.ListCreateAPIView):
    """API view to list agent reviews and create a new review (travelers only, after completing a trip)"""
    serializer_class = AgentReviewSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsTraveler()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        agent_id = self.kwargs.get('agent_id')
        return AgentReview.objects.filter(agent_id=agent_id).order_by('-created_at')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def create(self, request, *args, **kwargs):
        # Ensure overdue packages are marked completed before validating review eligibility
        _mark_overdue_packages_completed()
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        agent_id = self.kwargs.get('agent_id')
        from django.contrib.auth import get_user_model
        agent = get_user_model().objects.get(id=agent_id, role=Roles.AGENT)
        serializer.save(agent=agent)


class PublicAgentDetailView(generics.RetrieveAPIView):
    """Public traveler-facing agent profile details (profile, stats, recent reviews)."""
    serializer_class = PublicAgentDetailSerializer
    permission_classes = [permissions.AllowAny]
    lookup_url_kwarg = 'agent_id'

    def get_queryset(self):
        return AgentProfile.objects.select_related('user').filter(user__role=Roles.AGENT)

    def get_object(self):
        agent_id = self.kwargs.get(self.lookup_url_kwarg)
        agent_user = get_object_or_404(User.objects.filter(role=Roles.AGENT), id=agent_id)
        profile, _ = AgentProfile.objects.get_or_create(user=agent_user)
        return profile

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class BookingListCreateView(generics.ListCreateAPIView):
    """API view to list user's bookings and create a new booking"""
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated, IsTraveler]

    def get_queryset(self):
        _mark_overdue_packages_completed()
        return Booking.objects.filter(user=self.request.user).select_related('package').order_by('-created_at')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class BookingDetailView(generics.RetrieveUpdateAPIView):
    """
    Retrieve a single booking or cancel it (set status=cancelled).
    Travelers can only cancel their own bookings, with a 2-day cutoff enforced by the serializer.
    """
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated, IsTraveler]

    def get_queryset(self):
        return Booking.objects.filter(user=self.request.user).select_related('package')


class EsewaPaymentInitiateView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated, IsTraveler]

    def post(self, request, *args, **kwargs):
        package_id = request.data.get("package_id")
        traveler_count_raw = request.data.get("traveler_count", 1)
        reward_points_raw = request.data.get("reward_points_to_use", 0)

        try:
            traveler_count = int(traveler_count_raw)
        except (TypeError, ValueError):
            return response.Response(
                {"traveler_count": "Traveler count must be a valid number."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if traveler_count < 1:
            return response.Response(
                {"traveler_count": "Traveler count must be at least 1."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            package = Package.objects.get(pk=package_id, status=PackageStatus.ACTIVE)
        except Package.DoesNotExist:
            return response.Response(
                {"package_id": "Package not found or not available for booking."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if Booking.objects.filter(user=request.user, package=package, status=BookingStatus.CONFIRMED).exists():
            return response.Response(
                {"detail": "You have already booked this package."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        active_deal = get_active_deal(package)
        if active_deal:
            price_per_person = _money(active_deal.effective_price())
        else:
            price_per_person = _money(package.price_per_person)
        total_amount = _money(price_per_person * traveler_count)

        # Reward points: 1 point = 1 NPR. Clamp to available points and total amount.
        try:
            requested_points = int(reward_points_raw)
        except (TypeError, ValueError):
            requested_points = 0

        profile = getattr(request.user, "user_profile", None)
        available_points = int(getattr(profile, "reward_points", 0) or 0)
        max_redeemable = min(available_points, int(total_amount))
        reward_points_to_use = max(0, min(requested_points, max_redeemable))

        payable_amount = total_amount - Decimal(reward_points_to_use)
        if payable_amount < Decimal("0"):
            payable_amount = Decimal("0")

        # If reward points fully cover the booking cost, skip eSewa and book directly.
        if reward_points_to_use > 0 and payable_amount == Decimal("0"):
            if profile is None:
                return response.Response(
                    {"detail": "Traveler profile not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            with transaction.atomic():
                profile = (
                    UserProfile.objects.select_for_update()
                    .select_related("user")
                    .get(pk=profile.pk)
                )
                current_points = int(profile.reward_points or 0)
                if current_points < reward_points_to_use:
                    return response.Response(
                        {"detail": "Not enough reward points."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                profile.reward_points = current_points - reward_points_to_use
                profile.save(update_fields=["reward_points", "updated_at"])

                booking = Booking.objects.create(
                    user=request.user,
                    package=package,
                    status=BookingStatus.CONFIRMED,
                    traveler_count=traveler_count,
                    price_per_person_snapshot=price_per_person,
                    total_amount=total_amount,
                    payment_method=PaymentMethod.DIRECT,
                    payment_status=PaymentStatus.PAID,
                    payment_reference="REWARD_POINTS_ONLY",
                    transaction_uuid="",
                    reward_points_used=reward_points_to_use,
                )

                package.participants_count = (package.participants_count or 0) + booking.traveler_count
                package.save(update_fields=["participants_count"])

            serialized = BookingSerializer(booking, context={"request": request})
            return response.Response(
                {
                    "zero_payment": True,
                    "reward_points_used": reward_points_to_use,
                    "remaining_reward_points": profile.reward_points,
                    "booking": serialized.data,
                },
                status=status.HTTP_201_CREATED,
            )

        payment_session = EsewaPaymentSession.objects.create(
            user=request.user,
            package=package,
            transaction_uuid=str(uuid.uuid4()),
            traveler_count=traveler_count,
            price_per_person_snapshot=price_per_person,
            total_amount=total_amount,
            payable_amount=payable_amount,
            reward_points_used=reward_points_to_use,
            product_code=_esewa_product_code(),
            status=EsewaPaymentSessionStatus.INITIATED,
        )

        checkout_url = request.build_absolute_uri(
            reverse("esewa_payment_checkout", kwargs={"transaction_uuid": payment_session.transaction_uuid})
        )
        esewa_fields = _build_esewa_form_fields(request, payment_session)

        return response.Response(
            {
                "payment_method": "esewa",
                "status": payment_session.status,
                "transaction_uuid": payment_session.transaction_uuid,
                "traveler_count": traveler_count,
                "price_per_person": _money_str(price_per_person),
                "total_amount": _money_str(total_amount),
                "payable_amount": _money_str(payable_amount),
                "reward_points_used": reward_points_to_use,
                "available_reward_points": available_points,
                "checkout_url": checkout_url,
                "esewa_form_url": _esewa_form_url(),
                "esewa_fields": esewa_fields,
                "package": {
                    "id": package.id,
                    "title": package.title,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class EsewaPaymentCheckoutView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, transaction_uuid, *args, **kwargs):
        try:
            payment_session = EsewaPaymentSession.objects.get(transaction_uuid=transaction_uuid)
        except EsewaPaymentSession.DoesNotExist:
            return HttpResponse(
                _booking_payment_summary_html("Invalid Payment Session", "This eSewa payment session was not found.", "#b91c1c"),
                status=404,
            )

        fields = _build_esewa_form_fields(request, payment_session)
        inputs_html = "".join(
            f'<input type="hidden" name="{k}" value="{str(v)}" />'
            for k, v in fields.items()
        )
        html = f"""
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Redirecting to eSewa</title>
          </head>
          <body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:32px;">
            <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:24px;">
              <h2 style="margin:0 0 8px;color:#166534;">Redirecting to eSewa</h2>
              <p style="margin:0 0 16px;color:#4b5563;">If you are not redirected automatically, tap the button below.</p>
              <form id="esewa-payment-form" method="POST" action="{_esewa_form_url()}">
                {inputs_html}
                <button type="submit" style="background:#166534;color:#fff;border:none;border-radius:10px;padding:12px 16px;font-weight:700;cursor:pointer;">
                  Continue to eSewa
                </button>
              </form>
            </div>
            <script>
              setTimeout(function() {{
                var form = document.getElementById('esewa-payment-form');
                if (form) form.submit();
              }}, 350);
            </script>
          </body>
        </html>
        """
        return HttpResponse(html)


class EsewaPaymentSuccessCallbackView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]

    def _extract_payload(self, request):
        data_param = request.GET.get("data") or request.POST.get("data")
        if data_param:
            try:
                decoded = base64.b64decode(data_param).decode("utf-8")
                payload = json.loads(decoded)
                if isinstance(payload, dict):
                    return payload
            except Exception:
                pass
        payload = {}
        for key in ("transaction_uuid", "status", "ref_id", "transaction_code", "total_amount"):
            value = request.GET.get(key) or request.POST.get(key)
            if value not in (None, ""):
                payload[key] = value
        return payload

    def get(self, request, *args, **kwargs):
        payload = self._extract_payload(request)
        txn = payload.get("transaction_uuid")
        if txn:
            EsewaPaymentSession.objects.filter(transaction_uuid=txn).update(
                status=EsewaPaymentSessionStatus.SUCCESS_REDIRECTED,
                payment_reference=str(payload.get("ref_id") or payload.get("transaction_code") or ""),
                esewa_status=str(payload.get("status") or ""),
                verification_payload=payload,
            )
        return HttpResponse(
            _booking_payment_summary_html("Payment Submitted", "eSewa redirected successfully after payment."),
        )

    post = get


class EsewaPaymentFailureCallbackView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        txn = request.GET.get("transaction_uuid") or request.POST.get("transaction_uuid")
        if txn:
            EsewaPaymentSession.objects.filter(transaction_uuid=txn).update(
                status=EsewaPaymentSessionStatus.FAILED_REDIRECTED,
                esewa_status="FAILED",
            )
        return HttpResponse(
            _booking_payment_summary_html("Payment Failed", "eSewa reported a failed or cancelled payment.", "#b91c1c"),
        )

    post = get


class EsewaPaymentVerifyView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated, IsTraveler]

    def post(self, request, *args, **kwargs):
        transaction_uuid = (request.data.get("transaction_uuid") or "").strip()
        if not transaction_uuid:
            return response.Response(
                {"transaction_uuid": "transaction_uuid is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payment_session = EsewaPaymentSession.objects.select_related("package", "booking").get(
                transaction_uuid=transaction_uuid,
                user=request.user,
            )
        except EsewaPaymentSession.DoesNotExist:
            return response.Response(
                {"detail": "Payment session not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if payment_session.booking_id:
            serialized = BookingSerializer(payment_session.booking, context={"request": request})
            return response.Response(
                {
                    "verified": True,
                    "already_verified": True,
                    "esewa_status": payment_session.esewa_status or "COMPLETE",
                    "transaction_uuid": payment_session.transaction_uuid,
                    "booking": serialized.data,
                }
            )

        try:
            verification_payload = _verify_esewa_transaction(payment_session)
        except RuntimeError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        esewa_status_value = str(verification_payload.get("status") or "").upper()
        ref_id = str(verification_payload.get("ref_id") or verification_payload.get("transaction_code") or "").strip()

        payment_session.verification_payload = verification_payload if isinstance(verification_payload, dict) else {}
        payment_session.esewa_status = esewa_status_value
        payment_session.payment_reference = ref_id

        if esewa_status_value != "COMPLETE":
            payment_session.status = EsewaPaymentSessionStatus.VERIFY_FAILED
            payment_session.save(update_fields=["verification_payload", "esewa_status", "payment_reference", "status", "updated_at"])
            return response.Response(
                {
                    "verified": False,
                    "transaction_uuid": payment_session.transaction_uuid,
                    "esewa_status": esewa_status_value or "UNKNOWN",
                    "detail": "Payment is not completed yet. Please complete the payment in eSewa and verify again.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            payment_session = EsewaPaymentSession.objects.select_for_update().select_related("package").get(
                pk=payment_session.pk
            )
            if payment_session.booking_id:
                booking = payment_session.booking
            else:
                if Booking.objects.filter(
                    user=request.user,
                    package=payment_session.package,
                    status=BookingStatus.CONFIRMED,
                ).exists():
                    return response.Response(
                        {"detail": "You have already booked this package."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                booking = Booking.objects.create(
                    user=request.user,
                    package=payment_session.package,
                    status=BookingStatus.CONFIRMED,
                    traveler_count=max(int(payment_session.traveler_count or 1), 1),
                    price_per_person_snapshot=payment_session.price_per_person_snapshot,
                    total_amount=payment_session.total_amount,
                    payment_method=PaymentMethod.ESEWA,
                    payment_status=PaymentStatus.PAID,
                    payment_reference=ref_id,
                    transaction_uuid=payment_session.transaction_uuid,
                )

                package = payment_session.package
                package.participants_count = (package.participants_count or 0) + booking.traveler_count
                package.save(update_fields=["participants_count"])

                payment_session.booking = booking

            # Deduct any reward points used for this payment session (only once, on successful verification)
            reward_points_used = int(payment_session.reward_points_used or 0)
            remaining_reward_points = None
            if reward_points_used > 0:
                profile = getattr(request.user, "user_profile", None)
                if profile is not None:
                    current_points = int(getattr(profile, "reward_points", 0) or 0)
                    new_balance = max(0, current_points - reward_points_used)
                    if new_balance != current_points:
                        profile.reward_points = new_balance
                        profile.save(update_fields=["reward_points", "updated_at"])
                    remaining_reward_points = new_balance

                if getattr(booking, "reward_points_used", 0) != reward_points_used:
                    booking.reward_points_used = reward_points_used
                    booking.save(update_fields=["reward_points_used"])

            payment_session.verification_payload = verification_payload if isinstance(verification_payload, dict) else {}
            payment_session.esewa_status = esewa_status_value
            payment_session.payment_reference = ref_id
            payment_session.status = EsewaPaymentSessionStatus.VERIFIED
            payment_session.save(
                update_fields=[
                    "booking",
                    "verification_payload",
                    "esewa_status",
                    "payment_reference",
                    "status",
                    "updated_at",
                ]
            )

        serialized = BookingSerializer(booking, context={"request": request})
        return response.Response(
            {
                "verified": True,
                "already_verified": False,
                "esewa_status": esewa_status_value,
                "transaction_uuid": payment_session.transaction_uuid,
                "payment_reference": ref_id,
                "reward_points_used": int(payment_session.reward_points_used or 0),
                "remaining_reward_points": remaining_reward_points,
                "booking": serialized.data,
            }
        )


# Custom Package API (traveler-created packages; only visible to the creating user)
class CustomPackageListCreateView(generics.ListCreateAPIView):
    """List current user's custom packages and create a new one. Travelers only."""
    serializer_class = CustomPackageSerializer
    permission_classes = [permissions.IsAuthenticated, IsTraveler]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return CustomPackage.objects.filter(user=self.request.user).prefetch_related('features').order_by('-created_at')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CustomPackageDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a custom package. Only owner can access."""
    serializer_class = CustomPackageSerializer
    permission_classes = [permissions.IsAuthenticated, IsTraveler]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return CustomPackage.objects.filter(user=self.request.user).prefetch_related('features')


class CustomPackageClaimAndChatView(generics.GenericAPIView):
    """
    Agent-only endpoint to claim a traveler's custom package and get/create a chat room
    between the agent and the traveler.
    """

    permission_classes = [permissions.IsAuthenticated, IsAgent]

    def post(self, request, *args, **kwargs):
        custom_package_id = kwargs.get("pk")
        if not custom_package_id:
            return response.Response(
                {"detail": "Custom package ID is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            custom_package = CustomPackage.objects.select_related("user", "claimed_by").get(
                pk=custom_package_id, user__role=Roles.TRAVELER
            )
        except CustomPackage.DoesNotExist:
            return response.Response(
                {"detail": "Custom package not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        agent = request.user

        # If already claimed by another agent, do not allow taking over
        if custom_package.claimed_by and custom_package.claimed_by != agent:
            return response.Response(
                {
                    "detail": "This custom package is already claimed by another agent.",
                    "claimed_by_id": custom_package.claimed_by_id,
                },
                status=status.HTTP_409_CONFLICT,
            )

        # First claim or re-claim by the same agent
        from django.utils import timezone

        if not custom_package.claimed_by:
            custom_package.claimed_by = agent
            # Use the inner TextChoices for status
            custom_package.status = CustomPackage.CustomPackageStatus.CLAIMED
            custom_package.claimed_at = timezone.now()
            custom_package.save(update_fields=["claimed_by", "status", "claimed_at", "updated_at"])

        # Create or get chat room between traveler and this agent
        traveler = custom_package.user
        room, _ = ChatRoom.objects.get_or_create(traveler=traveler, agent=agent)

        serialized_room = ChatRoomSerializer(room, context={"request": request}).data
        return response.Response(
            {
                "room": serialized_room,
                "custom_package_id": custom_package.id,
                "status": custom_package.status,
            },
            status=status.HTTP_200_OK,
        )


class PackageFeatureListView(generics.ListAPIView):
    """List all package features (for custom package form and agent form). Read-only."""
    serializer_class = PackageFeatureSerializer
    permission_classes = [permissions.AllowAny]
    queryset = PackageFeature.objects.all().order_by('name')


# ---- Chat API views ----


class ChatMessagePagination(PageNumberPagination):
    """Smaller pages for chat history so we don't load everything at once.

    Used by both agent web chat and mobile clients. Default page size is kept
    intentionally small; clients can override with ?page_size=... up to max_page_size.
    """

    page_size = 30
    page_size_query_param = "page_size"
    max_page_size = 100


class ChatRoomListCreateView(generics.ListCreateAPIView):
    """List chat rooms for current user (traveler or agent). Create room with agent_id (traveler) or traveler_id (agent)."""
    serializer_class = ChatRoomSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == Roles.TRAVELER:
            return ChatRoom.objects.filter(traveler=user).select_related("traveler", "agent").prefetch_related("messages")
        if user.role == Roles.AGENT:
            return ChatRoom.objects.filter(agent=user).select_related("traveler", "agent").prefetch_related("messages")
        return ChatRoom.objects.none()

    def create(self, request, *args, **kwargs):
        user = request.user
        agent_id = request.data.get("agent_id")
        traveler_id = request.data.get("traveler_id")

        if user.role == Roles.TRAVELER and agent_id:
            try:
                agent = User.objects.get(pk=agent_id, role=Roles.AGENT)
            except User.DoesNotExist:
                return response.Response(
                    {"agent_id": "Agent not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            room, created = ChatRoom.objects.get_or_create(traveler=user, agent=agent)
        elif user.role == Roles.AGENT and traveler_id:
            try:
                traveler = User.objects.get(pk=traveler_id, role=Roles.TRAVELER)
            except User.DoesNotExist:
                return response.Response(
                    {"traveler_id": "Traveler not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            room, created = ChatRoom.objects.get_or_create(traveler=traveler, agent=user)
        else:
            return response.Response(
                {"detail": "Provide agent_id (as traveler) or traveler_id (as agent)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(room)
        return response.Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class ChatMessageListCreateView(generics.ListCreateAPIView):
    """List messages in a room (paginated). Create sends a message. Only room participants can access."""
    serializer_class = ChatMessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = ChatMessagePagination

    def get_queryset(self):
        room_id = self.kwargs.get("room_id")
        user = self.request.user
        try:
            room = ChatRoom.objects.get(pk=room_id)
        except ChatRoom.DoesNotExist:
            return ChatMessage.objects.none()
        if user not in (room.traveler, room.agent):
            return ChatMessage.objects.none()
        return ChatMessage.objects.filter(room=room).select_related("sender", "custom_package").order_by("-created_at")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["room_id"] = self.kwargs.get("room_id")
        return context

    def perform_create(self, serializer):
        room_id = self.kwargs.get("room_id")
        room = ChatRoom.objects.get(pk=room_id)
        custom_package = None
        cp_id = self.request.data.get("custom_package_id")
        if cp_id and self.request.user.role == Roles.AGENT:
            try:
                pkg = CustomPackage.objects.get(pk=cp_id, user=room.traveler)
                custom_package = pkg
            except (CustomPackage.DoesNotExist, ValueError, TypeError):
                pass
        msg = serializer.save(room=room, sender=self.request.user, custom_package=custom_package)
        room.updated_at = msg.created_at
        room.save(update_fields=["updated_at"])


class ChatUnreadCountView(generics.GenericAPIView):
    """GET: unread counts for current user.
    - count: total unread messages across all rooms
    - conversations: number of rooms (agents) that have unread messages (for chat icon badge)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        rooms = ChatRoom.objects.filter(
            Q(traveler=user) | Q(agent=user)
        ).prefetch_related("messages")
        total = 0
        conversations = 0
        for room in rooms:
            unread = room.messages.filter(is_read=False).exclude(sender=user).count()
            if unread > 0:
                conversations += 1
                total += unread
        return response.Response({"count": total, "conversations": conversations})


class ChatRoomMarkReadView(generics.GenericAPIView):
    """POST: mark all messages in a room as read (for current user - messages received from the other participant)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        room_id = kwargs.get("room_id")
        if not room_id:
            return response.Response({"detail": "Room ID required."}, status=status.HTTP_400_BAD_REQUEST)
        user = request.user
        try:
            room = ChatRoom.objects.get(pk=room_id)
        except ChatRoom.DoesNotExist:
            return response.Response({"detail": "Room not found."}, status=status.HTTP_404_NOT_FOUND)
        if user not in (room.traveler, room.agent):
            return response.Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)
        room.messages.filter(is_read=False).exclude(sender=user).update(is_read=True)
        return response.Response({"status": "ok"})


class ChatItineraryListCreateView(generics.ListCreateAPIView):
    """List itinerary items for a chat room. Create is agent-only."""

    serializer_class = ItineraryItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _get_room(self):
        room_id = self.kwargs.get("room_id")
        room = get_object_or_404(ChatRoom, pk=room_id)
        if self.request.user not in (room.traveler, room.agent):
            return None
        return room

    def get_queryset(self):
        room = self._get_room()
        if not room:
            return ItineraryItem.objects.none()
        return ItineraryItem.objects.filter(room=room).select_related("created_by", "trip").order_by(
            "trip_id", "day_number", "is_night", "time_label", "created_at"
        )

    def perform_create(self, serializer):
        room = self._get_room()
        if not room:
            raise permissions.PermissionDenied("Access denied.")
        if self.request.user != room.agent or self.request.user.role != Roles.AGENT:
            raise permissions.PermissionDenied("Only the agent can create itinerary items for this room.")
        serializer.save(room=room, created_by=self.request.user)


class ChatItineraryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete a single itinerary item. Update/delete is agent-only."""

    serializer_class = ItineraryItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        room_id = self.kwargs.get("room_id")
        user = self.request.user
        return ItineraryItem.objects.filter(
            room_id=room_id
        ).filter(
            Q(room__traveler=user) | Q(room__agent=user)
        ).select_related("created_by", "room")

    def perform_update(self, serializer):
        item = self.get_object()
        if self.request.user != item.room.agent or self.request.user.role != Roles.AGENT:
            raise permissions.PermissionDenied("Only the agent can update itinerary items for this room.")
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user != instance.room.agent or self.request.user.role != Roles.AGENT:
            raise permissions.PermissionDenied("Only the agent can delete itinerary items for this room.")
        instance.delete()


class ChatItineraryTripCreateView(generics.GenericAPIView):
    """POST: Create an itinerary trip with bulk items (agent-only). Used by the day/night wizard."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, room_id):
        room = get_object_or_404(ChatRoom, pk=room_id)
        if request.user != room.agent or request.user.role != Roles.AGENT:
            raise permissions.PermissionDenied("Only the agent can create itinerary trips for this room.")
        data = request.data
        start_date = data.get("start_date")
        days_count = int(data.get("days_count") or 1)
        nights_count = int(data.get("nights_count") or 0)
        items_data = data.get("items") or []
        if not start_date:
            return response.Response({"start_date": "Required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            return response.Response({"start_date": "Use YYYY-MM-DD format."}, status=status.HTTP_400_BAD_REQUEST)
        trip = ItineraryTrip.objects.create(
            room=room,
            created_by=request.user,
            start_date=start,
            days_count=days_count,
            nights_count=nights_count,
        )
        expected_slots = days_count + nights_count
        created = []
        for item_data in items_data[: 24 * expected_slots]:  # Max 24 entries per slot
            day_num = item_data.get("day_number", 1)
            is_night = item_data.get("is_night", False)
            travel_date = start + timedelta(days=(day_num if isinstance(day_num, int) else int(day_num)) - 1)
            item = ItineraryItem.objects.create(
                room=room,
                trip=trip,
                created_by=request.user,
                day_number=day_num,
                is_night=is_night,
                travel_date=travel_date,
                day_label=(item_data.get("day_label") or "").strip(),
                time_label=(item_data.get("time_label") or "").strip() or "—",
                place=(item_data.get("place") or "").strip() or "—",
                activity=(item_data.get("activity") or "").strip() or "—",
                food_name=(item_data.get("food_name") or "").strip(),
                notes=(item_data.get("notes") or "").strip(),
            )
            created.append(item)
        return response.Response(
            {"id": trip.id, "message": "Itinerary trip created.", "items_count": len(created)},
            status=status.HTTP_201_CREATED,
        )


class ChatItineraryTripPdfView(generics.GenericAPIView):
    """GET: Stream itinerary PDF for preview (Check itinerary). Room participants only. Supports ?access=JWT for mobile."""

    permission_classes = [permissions.AllowAny]  # Auth checked manually to support token-in-query

    def get(self, request, room_id, trip_id):
        access_token = request.query_params.get("access") or request.GET.get("access")
        if access_token:
            from rest_framework_simplejwt.tokens import AccessToken
            from rest_framework_simplejwt.exceptions import InvalidToken
            try:
                token = AccessToken(access_token)
                user = User.objects.get(pk=token["user_id"])
            except (InvalidToken, User.DoesNotExist, KeyError):
                return response.Response({"detail": "Invalid or expired token."}, status=status.HTTP_401_UNAUTHORIZED)
        elif request.user.is_authenticated:
            user = request.user
        else:
            return response.Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        room = get_object_or_404(ChatRoom, pk=room_id)
        if user not in (room.traveler, room.agent):
            raise permissions.PermissionDenied("Access denied.")
        trip = get_object_or_404(ItineraryTrip, pk=trip_id, room=room)
        from .itinerary_pdf import build_itinerary_pdf

        buf = build_itinerary_pdf(trip)
        resp = HttpResponse(buf.getvalue(), content_type="application/pdf")
        resp["Content-Disposition"] = 'inline; filename="itinerary.pdf"'
        return resp


class ChatItineraryTripSendView(generics.GenericAPIView):
    """POST: Generate PDF, attach to new chat message, send to traveler (agent-only)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, room_id, trip_id):
        room = get_object_or_404(ChatRoom, pk=room_id)
        if request.user != room.agent or request.user.role != Roles.AGENT:
            raise permissions.PermissionDenied("Only the agent can send itinerary for this room.")
        trip = get_object_or_404(ItineraryTrip, pk=trip_id, room=room)
        from django.core.files.base import ContentFile
        from .itinerary_pdf import build_itinerary_pdf

        buf = build_itinerary_pdf(trip)
        pdf_content = buf.getvalue()
        filename = f"itinerary_{trip.start_date}_{trip.days_count}d{trip.nights_count}n.pdf"
        msg = ChatMessage.objects.create(
            room=room,
            sender=request.user,
            text=f"Your trip itinerary ({trip.start_date}, {trip.days_count} Days / {trip.nights_count} Nights) is attached.",
        )
        msg.attachment.save(filename, ContentFile(pdf_content), save=True)
        room.updated_at = msg.created_at
        room.save(update_fields=["updated_at"])
        return response.Response(
            {
                "message_id": msg.id,
                "attachment_url": request.build_absolute_uri(msg.attachment.url) if msg.attachment else None,
            },
            status=status.HTTP_200_OK,
        )


# ---- Notification API views ----


class NotificationListCreateView(generics.ListCreateAPIView):
    """
    GET: List notifications for the current user (recipients only).
    POST: Create and send notification (admin or agent only). Requires target_type and optional user_ids.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return NotificationCreateSerializer
        return NotificationSerializer

    def get_queryset(self):
        user = self.request.user
        return Notification.objects.filter(
            recipients__user=user
        ).select_related("sender").distinct().order_by("-created_at")

    def create(self, request, *args, **kwargs):
        user = request.user
        if user.role not in (Roles.ADMIN, Roles.AGENT):
            return response.Response(
                {"detail": "Only admin or agent can send notifications."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = NotificationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        target_type = data["target_type"]
        user_ids = data.get("user_ids") or []

        if target_type == "my_travelers" and user.role != Roles.AGENT:
            return response.Response(
                {"detail": "Only agents can use 'my_travelers' target."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if target_type == "specific" and not user_ids:
            return response.Response(
                {"detail": "user_ids required when target_type is 'specific'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if target_type == "my_travelers":
            traveler_ids = set()
            traveler_ids.update(
                Booking.objects.filter(package__agent=user).values_list("user_id", flat=True)
            )
            traveler_ids.update(
                ChatRoom.objects.filter(agent=user).values_list("traveler_id", flat=True)
            )
            recipients = User.objects.filter(id__in=traveler_ids, role=Roles.TRAVELER)
        elif target_type == "all_travelers":
            recipients = User.objects.filter(role=Roles.TRAVELER)
        elif target_type == "all_users":
            recipients = User.objects.all()
        else:
            recipients = User.objects.filter(id__in=user_ids)

        if not recipients.exists():
            return response.Response(
                {"detail": "No recipients found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        notification_type = data.get("notification_type") or "general"
        with transaction.atomic():
            notification = Notification.objects.create(
                title=data["title"],
                message=data["message"],
                notification_type=notification_type,
                sender=user,
            )
            NotificationRecipient.objects.bulk_create(
                [NotificationRecipient(notification=notification, user=u) for u in recipients]
            )

        recipient_ids = list(recipients.values_list("id", flat=True))
        send_expo_push_for_notification(notification, recipient_ids)

        out_serializer = NotificationSerializer(notification, context={"request": request})
        return response.Response(out_serializer.data, status=status.HTTP_201_CREATED)


class NotificationUnreadCountView(generics.GenericAPIView):
    """GET: unread notification count for current user."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        count = NotificationRecipient.objects.filter(
            user=request.user,
            is_read=False,
        ).count()
        return response.Response({"count": count})


class NotificationMarkReadView(generics.GenericAPIView):
    """POST: mark a notification as read for current user."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        recipient_id = kwargs.get("recipient_id") or request.data.get("recipient_id")
        notification_id = request.data.get("notification_id")
        if not recipient_id and not notification_id:
            return response.Response(
                {"detail": "recipient_id or notification_id required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = request.user
        if recipient_id:
            updated = NotificationRecipient.objects.filter(
                id=recipient_id, user=user
            ).update(is_read=True)
        else:
            updated = NotificationRecipient.objects.filter(
                notification_id=notification_id, user=user
            ).update(is_read=True)
        if not updated:
            return response.Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return response.Response({"status": "ok"})


class ExpoPushTokenRegisterView(generics.GenericAPIView):
    """POST: register this device's Expo push token for the logged-in user."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ExpoPushTokenRegisterSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["expo_push_token"]
        ExpoPushToken.objects.update_or_create(
            token=token,
            defaults={"user": request.user},
        )
        return response.Response({"status": "ok"}, status=status.HTTP_200_OK)
