from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .forms import CustomUserChangeForm, CustomUserCreationForm
from .models import User, UserProfile, AgentProfile, Package, PackageFeature


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


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'full_name', 'phone_number', 'city', 'country', 'created_at']
    list_filter = ['country', 'city', 'created_at']
    search_fields = ['user__email', 'first_name', 'last_name', 'phone_number']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(AgentProfile)
class AgentProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'full_name', 'company_name', 'is_verified', 'city', 'country', 'created_at']
    list_filter = ['is_verified', 'country', 'city', 'created_at']
    search_fields = ['user__email', 'first_name', 'last_name', 'company_name', 'license_number']
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
