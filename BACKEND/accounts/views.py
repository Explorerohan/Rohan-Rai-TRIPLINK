import time
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib import messages
from django.shortcuts import render, redirect
from rest_framework import generics, permissions, response, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .emailjs_utils import generate_otp, send_otp_email
from .models import Roles, UserProfile, AgentProfile, Package, PackageFeature, PackageStatus
from .feature_options import get_feature_icon, get_all_feature_options
from .permissions import IsAdminRole, IsAgent, IsTraveler
from .serializers import (
    CustomTokenObtainPairSerializer, RegisterSerializer, UserSerializer,
    UserProfileSerializer, AgentProfileSerializer, PackageSerializer
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




def admin_dashboard_view(request):
    """Placeholder admin dashboard view"""
    if not request.user.is_authenticated or request.user.role != Roles.ADMIN:
        messages.error(request, 'Access denied. Admin access required.')
        return redirect('login')
    return render(request, 'admin_dashboard.html', {'user': request.user})


def agent_dashboard_view(request):
    """Placeholder agent dashboard view"""
    if not request.user.is_authenticated or request.user.role != Roles.AGENT:
        messages.error(request, 'Access denied. Agent access required.')
        return redirect('login')
    return render(request, 'agent_dashboard.html', {'user': request.user, 'active_nav': 'dashboard'})


def logout_view(request):
    """Unified logout view for admin and agent"""
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
    recent_packages = packages[:7]  # Last 7 non-completed packages
    completed_packages = Package.objects.filter(
        agent=request.user, status=PackageStatus.COMPLETED
    ).order_by('-updated_at')[:4]  # Last 4 completed
    
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
    }
    return render(request, 'agent_packages.html', context)


def agent_add_package_view(request):
    """View to add a new package"""
    if not request.user.is_authenticated or request.user.role != Roles.AGENT:
        messages.error(request, 'Access denied. Agent access required.')
        return redirect('login')
    
    if request.method == 'POST':
        try:
            package = Package.objects.create(
                agent=request.user,
                title=request.POST.get('title', '').strip(),
                location=request.POST.get('location', '').strip(),
                country=request.POST.get('country', '').strip(),
                description=request.POST.get('description', '').strip(),
                price_per_person=request.POST.get('price_per_person', 0),
                duration_days=int(request.POST.get('duration_days', 7)),
                duration_nights=int(request.POST.get('duration_nights', 6)),
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


# API Views for Packages
class PackageListView(generics.ListAPIView):
    """API view to list all active packages"""
    serializer_class = PackageSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        queryset = Package.objects.filter(status=PackageStatus.ACTIVE).order_by('-created_at')
        # Optional filters
        location = self.request.query_params.get('location', None)
        country = self.request.query_params.get('country', None)
        
        if location:
            queryset = queryset.filter(location__icontains=location)
        if country:
            queryset = queryset.filter(country__icontains=country)
        
        return queryset
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class PackageDetailView(generics.RetrieveAPIView):
    """API view to get package details"""
    serializer_class = PackageSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Package.objects.filter(status=PackageStatus.ACTIVE)
    lookup_field = 'id'
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
