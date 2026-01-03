import time
from django.contrib.auth import authenticate, login, get_user_model
from django.contrib import messages
from django.shortcuts import render, redirect
from rest_framework import generics, permissions, response, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .emailjs_utils import generate_otp, send_otp_email
from .models import Roles, UserProfile, AgentProfile
from .permissions import IsAdminRole, IsAgent, IsTraveler
from .serializers import (
    CustomTokenObtainPairSerializer, RegisterSerializer, UserSerializer,
    UserProfileSerializer, AgentProfileSerializer
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


# Template-based views for admin and agent login
def admin_login_view(request):
    """Render and handle admin login form"""
    if request.user.is_authenticated and request.user.role == Roles.ADMIN:
        return render(request, 'admin_login_success.html', {'user': request.user})
    
    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')
        
        if email and password:
            user = authenticate(request, username=email, password=password)
            if user is not None:
                if user.role == Roles.ADMIN:
                    login(request, user)
                    return render(request, 'admin_login_success.html', {'user': user})
                else:
                    messages.error(request, 'Access denied. This account is not an admin account.')
            else:
                messages.error(request, 'Invalid email or password.')
        else:
            messages.error(request, 'Please fill in all fields.')
    
    return render(request, 'admin_login.html')


def agent_login_view(request):
    """Render and handle agent login form"""
    if request.user.is_authenticated and request.user.role == Roles.AGENT:
        return render(request, 'agent_login_success.html', {'user': request.user})
    
    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')
        
        if email and password:
            user = authenticate(request, username=email, password=password)
            if user is not None:
                if user.role == Roles.AGENT:
                    login(request, user)
                    return render(request, 'agent_login_success.html', {'user': user})
                else:
                    messages.error(request, 'Access denied. This account is not an agent account.')
            else:
                messages.error(request, 'Invalid email or password.')
        else:
            messages.error(request, 'Please fill in all fields.')
    
    return render(request, 'agent_login.html')


def admin_dashboard_view(request):
    """Placeholder admin dashboard view"""
    if not request.user.is_authenticated or request.user.role != Roles.ADMIN:
        messages.error(request, 'Access denied. Admin access required.')
        return redirect('admin_login')
    return render(request, 'admin_dashboard.html', {'user': request.user})


def agent_dashboard_view(request):
    """Placeholder agent dashboard view"""
    if not request.user.is_authenticated or request.user.role != Roles.AGENT:
        messages.error(request, 'Access denied. Agent access required.')
        return redirect('agent_login')
    return render(request, 'agent_dashboard.html', {'user': request.user})


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
            return redirect('admin_login')
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
            return redirect('agent_login')
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
