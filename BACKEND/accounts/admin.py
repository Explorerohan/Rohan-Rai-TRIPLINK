from django.contrib import admin
from django.contrib import messages
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.urls import reverse

from .forms import CustomUserChangeForm, CustomUserCreationForm
from .models import User, UserProfile, AgentProfile, Package, PackageFeature, CustomPackage, Booking, AgentReview, Roles
from .emailjs_utils import send_agent_credentials_email


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    model = User
    add_form = CustomUserCreationForm
    form = CustomUserChangeForm
    list_display = ("email", "role", "is_staff", "is_active")
    list_filter = ("role", "is_staff", "is_active")
    ordering = ("email",)
    search_fields = ("email",)

    fieldsets = (
        (None, {"fields": ("email", "password", "role")}),
        (
            "Permissions",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "role", "password1", "password2", "is_active", "is_staff"),
            },
        ),
    )

    def save_model(self, request, obj, form, change):
        is_new_agent = not change and obj.role == Roles.AGENT
        raw_password = form.cleaned_data.get("password1") if is_new_agent else None

        super().save_model(request, obj, form, change)

        if not is_new_agent or not raw_password:
            return

        try:
            login_url = request.build_absolute_uri(reverse("login"))
            agent_name = obj.email.split("@")[0].replace(".", " ").replace("_", " ").title()
            send_agent_credentials_email(
                email=obj.email,
                password=raw_password,
                login_url=login_url,
                agent_name=agent_name,
            )
            self.message_user(
                request,
                f"Agent account created. Credentials email sent to {obj.email}.",
                level=messages.SUCCESS,
            )
        except Exception as exc:
            self.message_user(
                request,
                f"Agent account created, but credentials email could not be sent: {exc}",
                level=messages.WARNING,
            )


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'full_name', 'phone_number', 'location', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__email', 'first_name', 'last_name', 'phone_number']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(AgentProfile)
class AgentProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'full_name', 'phone_number', 'location', 'rating', 'is_verified', 'created_at']
    list_filter = ['is_verified', 'created_at']
    search_fields = ['user__email', 'first_name', 'last_name', 'phone_number']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(PackageFeature)
class PackageFeatureAdmin(admin.ModelAdmin):
    list_display = ['name', 'icon', 'created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at']


@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    list_display = ['title', 'location', 'country', 'agent', 'price_per_person', 'status', 'created_at']
    list_filter = ['status', 'country', 'created_at']
    search_fields = ['title', 'location', 'country', 'agent__email']
    readonly_fields = ['created_at', 'updated_at']
    filter_horizontal = ['features']


@admin.register(CustomPackage)
class CustomPackageAdmin(admin.ModelAdmin):
    list_display = ['title', 'location', 'country', 'user', 'price_per_person', 'created_at']
    list_filter = ['country', 'created_at']
    search_fields = ['title', 'location', 'country', 'user__email']
    readonly_fields = ['created_at', 'updated_at']
    filter_horizontal = ['features']


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ['user', 'package', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['user__email', 'package__title']
    readonly_fields = ['created_at']


@admin.register(AgentReview)
class AgentReviewAdmin(admin.ModelAdmin):
    list_display = ['user', 'agent', 'rating', 'created_at']
    list_filter = ['rating', 'created_at']
    search_fields = ['user__email', 'agent__email', 'comment']
    readonly_fields = ['created_at', 'updated_at']
