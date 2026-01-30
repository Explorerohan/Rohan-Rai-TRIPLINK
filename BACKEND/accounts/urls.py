from django.urls import path

from .views import (
    LoginView,
    LogoutView,
    MeView,
    RefreshView,
    RegisterView,
    ProfileView,
    UserProfileView,
    AgentProfileView,
    PackageListView,
    PackageDetailView,
    BookingListCreateView,
    ReviewListCreateView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="token_obtain_pair"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("refresh/", RefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    # Profile endpoints
    path("profile/", ProfileView.as_view(), name="profile"),
    path("profile/user/", UserProfileView.as_view(), name="user_profile"),
    path("profile/agent/", AgentProfileView.as_view(), name="agent_profile"),
    # Package endpoints
    path("packages/", PackageListView.as_view(), name="package_list"),
    path("packages/<int:id>/", PackageDetailView.as_view(), name="package_detail"),
    # Review endpoints
    path("packages/<int:package_id>/reviews/", ReviewListCreateView.as_view(), name="review_list_create"),
    # Booking endpoints
    path("bookings/", BookingListCreateView.as_view(), name="booking_list_create"),
]