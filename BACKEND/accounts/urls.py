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
    AgentReviewListCreateView,
    CustomPackageListCreateView,
    CustomPackageDetailView,
    CustomPackageClaimAndChatView,
    PackageFeatureListView,
    ChatRoomListCreateView,
    ChatMessageListCreateView,
    ChatUnreadCountView,
    ChatRoomMarkReadView,
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
    # Agent review endpoints (travelers review agents after completing a trip)
    path("agents/<int:agent_id>/reviews/", AgentReviewListCreateView.as_view(), name="agent_review_list_create"),
    # Booking endpoints
    path("bookings/", BookingListCreateView.as_view(), name="booking_list_create"),
    # Custom packages (traveler-created; only visible to owner)
    path("custom-packages/", CustomPackageListCreateView.as_view(), name="custom_package_list_create"),
    path("custom-packages/<int:pk>/", CustomPackageDetailView.as_view(), name="custom_package_detail"),
    path(
        "custom-packages/<int:pk>/claim-and-chat/",
        CustomPackageClaimAndChatView.as_view(),
        name="custom_package_claim_and_chat",
    ),
    # Features list (for custom package / agent forms)
    path("features/", PackageFeatureListView.as_view(), name="package_feature_list"),
    # Chat
    path("chat/rooms/", ChatRoomListCreateView.as_view(), name="chat_room_list_create"),
    path("chat/rooms/<int:room_id>/messages/", ChatMessageListCreateView.as_view(), name="chat_message_list_create"),
    path("chat/unread-count/", ChatUnreadCountView.as_view(), name="chat_unread_count"),
    path("chat/rooms/<int:room_id>/mark-read/", ChatRoomMarkReadView.as_view(), name="chat_room_mark_read"),
]