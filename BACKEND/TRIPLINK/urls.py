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
    login_view, logout_view, admin_login_view, agent_login_view, admin_dashboard_view, agent_dashboard_view,
    admin_forgot_password_view, agent_forgot_password_view,
    admin_verify_otp_view, agent_verify_otp_view,
    admin_reset_password_view, agent_reset_password_view,
    agent_profile_view, agent_logout_view
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    # Unified login and logout URLs
    path('login/', login_view, name='login'),
    path('logout/', logout_view, name='logout'),
    # Keep old URLs for backward compatibility (redirect to unified login)
    path('login/admin/', admin_login_view, name='admin_login'),
    path('login/agent/', agent_login_view, name='agent_login'),
    path('logout/agent/', agent_logout_view, name='agent_logout'),
    path('dashboard/admin/', admin_dashboard_view, name='admin_dashboard'),
    path('dashboard/agent/', agent_dashboard_view, name='agent_dashboard'),
    path('profile/agent/', agent_profile_view, name='agent_profile'),
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
