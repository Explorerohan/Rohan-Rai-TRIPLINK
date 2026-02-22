import time
from datetime import datetime, date, timedelta
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib import messages
from django.db import transaction
from django.db.models import Q, Count, Sum, Avg
from django.db.models.functions import TruncMonth
from django.shortcuts import render, redirect
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from rest_framework import generics, permissions, response, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .emailjs_utils import generate_otp, send_otp_email, send_agent_credentials_email
from .models import Roles, UserProfile, AgentProfile, Package, PackageFeature, PackageStatus, CustomPackage, Booking, BookingStatus, AgentReview, ChatRoom, ChatMessage
from .feature_options import get_feature_icon, get_all_feature_options
from .permissions import IsAdminRole, IsAgent, IsTraveler
from .serializers import (
    CustomTokenObtainPairSerializer,
    RegisterSerializer,
    UserSerializer,
    UserProfileSerializer,
    AgentProfileSerializer,
    PackageSerializer,
    BookingSerializer,
    PackageDetailSerializer,
    AgentReviewSerializer,
    CustomPackageSerializer,
    PackageFeatureSerializer,
    ChatRoomSerializer,
    ChatMessageSerializer,
)

User = get_user_model()


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

    verified_agents = AgentProfile.objects.filter(user__role=Roles.AGENT, is_verified=True).count()
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

    verification_rate = _safe_pct(verified_agents, total_agents)
    if verification_rate < 60:
        insights.append(
            f"Only {verification_rate}% of agents are verified. Increasing verification can improve traveler trust."
        )
    else:
        insights.append(f"Agent verification is healthy at {verification_rate}%.")

    context = {
        "user": request.user,
        "stats": {
            "total_users": total_users,
            "total_admins": total_admins,
            "travelers": total_travelers,
            "agents": total_agents,
            "verified_agents": verified_agents,
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
            "agent_verification_rate": verification_rate,
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

    traveler_users = User.objects.filter(role=Roles.TRAVELER).order_by('-date_joined')
    travelers = []
    for u in traveler_users:
        try:
            profile = u.user_profile
        except UserProfile.DoesNotExist:
            profile = None
        travelers.append({'user': u, 'profile': profile})

    agent_users = User.objects.filter(role=Roles.AGENT).order_by('-date_joined')
    agents = []
    for u in agent_users:
        try:
            profile = u.agent_profile
        except AgentProfile.DoesNotExist:
            profile = None
        agents.append({'user': u, 'profile': profile})

    context = {
        'user': request.user,
        'travelers': travelers,
        'agents': agents,
        'create_agent_form': create_agent_form,
        'active_nav': 'users',
    }
    return render(request, 'admin_users.html', context)


def agent_dashboard_view(request):
    """Placeholder agent dashboard view"""
    if not request.user.is_authenticated or request.user.role != Roles.AGENT:
        messages.error(request, 'Access denied. Agent access required.')
        return redirect('login')
    return render(request, 'agent_dashboard.html', {'user': request.user, 'active_nav': 'dashboard'})


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
class UserProfileView(generics.RetrieveUpdateAPIView):
    """View for retrieving and updating user (traveler) profile"""
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsTraveler]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        profile, created = UserProfile.objects.get_or_create(user=self.request.user)
        return profile

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


class ProfileView(generics.RetrieveUpdateAPIView):
    """Universal profile view that returns the appropriate profile based on user role"""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

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
        return context


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
