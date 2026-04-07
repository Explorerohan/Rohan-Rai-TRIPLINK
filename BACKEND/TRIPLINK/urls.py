"""
URL configuration for TRIPLINK project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from accounts.views import (
    login_view, logout_view, admin_dashboard_view, admin_users_view, admin_packages_view, admin_package_detail_view,
    admin_notifications_view, admin_refunds_view, agent_dashboard_view, agent_notifications_view, agent_refunds_view,
    admin_forgot_password_view, agent_forgot_password_view,
    admin_verify_otp_view, agent_verify_otp_view,
    admin_reset_password_view, agent_reset_password_view,
    agent_profile_view, agent_packages_view, agent_add_package_view,
    agent_edit_package_view, agent_delete_package_view,
    agent_package_detail_view, agent_travelers_view, agent_bookings_view, agent_booking_detail_view, agent_calendar_view,
    agent_custom_packages_view, agent_custom_package_detail_view, agent_custom_package_publish_view,
    agent_chat_view, agent_reviews_view, agent_deals_view, agent_settings_view,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    # Unified login and logout URLs
    path('login/', login_view, name='login'),
    path('logout/', logout_view, name='logout'),
    path('dashboard/admin/', admin_dashboard_view, name='admin_dashboard'),
    path('users/admin/', admin_users_view, name='admin_users'),
    path('packages/admin/', admin_packages_view, name='admin_packages'),
    path('packages/admin/<int:package_id>/', admin_package_detail_view, name='admin_package_detail'),
    path('notifications/admin/', admin_notifications_view, name='admin_notifications'),
    path('refunds/admin/', admin_refunds_view, name='admin_refunds'),
    path('dashboard/agent/', agent_dashboard_view, name='agent_dashboard'),
    path('refunds/agent/', agent_refunds_view, name='agent_refunds'),
    path('notifications/agent/', agent_notifications_view, name='agent_notifications'),
    path('profile/agent/', agent_profile_view, name='agent_profile'),
    path('settings/agent/', agent_settings_view, name='agent_settings'),
    # Package management URLs
    path('packages/agent/', agent_packages_view, name='agent_packages'),
    path('packages/agent/add/', agent_add_package_view, name='agent_add_package'),
    path('packages/agent/<int:package_id>/', agent_package_detail_view, name='agent_package_detail'),
    path('packages/agent/edit/<int:package_id>/', agent_edit_package_view, name='agent_edit_package'),
    path('packages/agent/delete/<int:package_id>/', agent_delete_package_view, name='agent_delete_package'),
    path('travelers/agent/', agent_travelers_view, name='agent_travelers'),
    path('bookings/agent/', agent_bookings_view, name='agent_bookings'),
    path('bookings/agent/<int:booking_id>/', agent_booking_detail_view, name='agent_booking_detail'),
    path('calendar/agent/', agent_calendar_view, name='agent_calendar'),
    path('custom-packages/agent/', agent_custom_packages_view, name='agent_custom_packages'),
    path('custom-packages/agent/<int:pk>/', agent_custom_package_detail_view, name='agent_custom_package_detail'),
    path('custom-packages/agent/<int:pk>/publish/', agent_custom_package_publish_view, name='agent_custom_package_publish'),
    path('chat/agent/', agent_chat_view, name='agent_chat'),
    path('reviews/agent/', agent_reviews_view, name='agent_reviews'),
    path('deals/agent/', agent_deals_view, name='agent_deals'),
    # Forgot password URLs
    path('forgot-password/admin/', admin_forgot_password_view, name='admin_forgot_password'),
    path('forgot-password/agent/', agent_forgot_password_view, name='agent_forgot_password'),
    # OTP verification URLs
    path('verify-otp/admin/', admin_verify_otp_view, name='admin_verify_otp'),
    path('verify-otp/agent/', agent_verify_otp_view, name='agent_verify_otp'),
    # Password reset URLs
    path('reset-password/admin/', admin_reset_password_view, name='admin_reset_password'),
    path('reset-password/agent/', agent_reset_password_view, name='agent_reset_password'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
