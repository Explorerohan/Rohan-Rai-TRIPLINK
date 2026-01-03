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
]