from django.urls import path

from .views import (
    AdminOnlyView,
    AgentOnlyView,
    LoginView,
    MeView,
    RefreshView,
    RegisterView,
    TravelerOnlyView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="token_obtain_pair"),
    path("refresh/", RefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("only/traveler/", TravelerOnlyView.as_view(), name="only_traveler"),
    path("only/agent/", AgentOnlyView.as_view(), name="only_agent"),
    path("only/admin/", AdminOnlyView.as_view(), name="only_admin"),
]
