from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class Roles(models.TextChoices):
    TRAVELER = "traveler", "Traveler"
    AGENT = "agent", "Agent"
    ADMIN = "admin", "Admin"


class UserManager(BaseUserManager):
    """Custom manager using email as the unique identifier."""

    def create_user(self, email, password=None, role=Roles.TRAVELER, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
        email = self.normalize_email(email)
        user = self.model(email=email, role=role, **extra_fields)
        if password:
            user.set_password(password)
        else:
            raise ValueError("Users must have a password")
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("role", Roles.ADMIN)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    username = None  # Remove username field; email is the unique identifier
    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=20,
        choices=Roles.choices,
        default=Roles.TRAVELER,
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return f"{self.email} ({self.role})"


def user_profile_image_path(instance, filename):
    """Generate file path for user profile images"""
    return f'profiles/users/{instance.user.id}/{filename}'


def agent_profile_image_path(instance, filename):
    """Generate file path for agent profile images"""
    return f'profiles/agents/{instance.user.id}/{filename}'


def package_image_path(instance, filename):
    """Generate file path for package images"""
    if instance.pk:
        return f'packages/{instance.pk}/{filename}'
    return f'packages/temp/{filename}'


class UserProfile(models.Model):
    """Profile model for Traveler users"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='user_profile')
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    profile_picture = models.ImageField(upload_to=user_profile_image_path, null=True, blank=True)
    # Simplified profile: single location field instead of multiple address fields
    location = models.CharField(max_length=200, blank=True, help_text="User location")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"

    def __str__(self):
        return f"{self.user.email} - Profile"

    @property
    def full_name(self):
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        elif self.first_name:
            return self.first_name
        elif self.last_name:
            return self.last_name
        return self.user.email.split('@')[0]


class AgentProfile(models.Model):
    """Profile model for Agent users"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='agent_profile')
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    profile_picture = models.ImageField(upload_to=agent_profile_image_path, null=True, blank=True)
    # Simplified profile: single location field instead of multiple address / company fields
    location = models.CharField(max_length=200, blank=True, help_text="Agent location")
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Agent Profile"
        verbose_name_plural = "Agent Profiles"

    def __str__(self):
        return f"{self.user.email} - Agent Profile"

    @property
    def full_name(self):
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        elif self.first_name:
            return self.first_name
        elif self.last_name:
            return self.last_name
        return self.user.email.split('@')[0]


class PackageStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    COMPLETED = "completed", "Completed"
    DRAFT = "draft", "Draft"


class PackageFeature(models.Model):
    """Features available in packages (All Inclusive, Accommodation, Gym, Pool, etc.)"""
    name = models.CharField(max_length=100, unique=True)
    icon = models.CharField(max_length=50, blank=True, help_text="Icon emoji or class name")
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Package Feature"
        verbose_name_plural = "Package Features"
        ordering = ['name']

    def __str__(self):
        return self.name


class Package(models.Model):
    """Trip package model for agents"""
    agent = models.ForeignKey(User, on_delete=models.CASCADE, related_name='packages', limit_choices_to={'role': Roles.AGENT})
    title = models.CharField(max_length=200, help_text="Package title (e.g., PARIS)")
    location = models.CharField(max_length=200, help_text="Location name (e.g., Paris)")
    country = models.CharField(max_length=100, help_text="Country name (e.g., France)")
    description = models.TextField(help_text="Detailed description of the package")
    price_per_person = models.DecimalField(max_digits=10, decimal_places=2, help_text="Price in Rs.")
    duration_days = models.PositiveIntegerField(default=7, help_text="Number of days")
    duration_nights = models.PositiveIntegerField(default=6, help_text="Number of nights")
    trip_start_date = models.DateField(
        null=True,
        blank=True,
        help_text="Trip start date (from when)",
    )
    trip_end_date = models.DateField(
        null=True,
        blank=True,
        help_text="Trip end date (to when)",
    )
    main_image = models.ImageField(upload_to=package_image_path, null=True, blank=True)
    features = models.ManyToManyField(PackageFeature, related_name='packages', blank=True)
    status = models.CharField(
        max_length=20,
        choices=PackageStatus.choices,
        default=PackageStatus.ACTIVE
    )
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=0.0, help_text="Average rating (0-5)")
    participants_count = models.PositiveIntegerField(default=0, help_text="Number of people who joined")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Package"
        verbose_name_plural = "Packages"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} - {self.location}, {self.country}"

    @property
    def duration_display(self):
        return f"{self.duration_days} Days / {self.duration_nights} Nights"


class BookingStatus(models.TextChoices):
    CONFIRMED = "confirmed", "Confirmed"
    CANCELLED = "cancelled", "Cancelled"


class Booking(models.Model):
    """Booking: a traveler books a package"""
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="bookings",
        limit_choices_to={"role": Roles.TRAVELER},
    )
    package = models.ForeignKey(
        Package,
        on_delete=models.CASCADE,
        related_name="bookings",
    )
    status = models.CharField(
        max_length=20,
        choices=BookingStatus.choices,
        default=BookingStatus.CONFIRMED,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Booking"
        verbose_name_plural = "Bookings"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.email} – {self.package.title}"


class Review(models.Model):
    """Review left by a traveler for a package they booked"""
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="reviews",
        limit_choices_to={"role": Roles.TRAVELER},
    )
    package = models.ForeignKey(
        Package,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    rating = models.PositiveIntegerField(
        help_text="Rating from 1 to 5"
    )
    comment = models.TextField(blank=True, help_text="Review comment")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Review"
        verbose_name_plural = "Reviews"
        ordering = ["-created_at"]
        unique_together = ["user", "package"]  # One review per user per package

    def __str__(self):
        return f"{self.user.email} - {self.package.title} ({self.rating}/5)"

    def save(self, *args, **kwargs):
        # Ensure rating is between 1 and 5
        if self.rating < 1:
            self.rating = 1
        elif self.rating > 5:
            self.rating = 5
        super().save(*args, **kwargs)
        # Update package average rating
        self._update_package_rating()

    def delete(self, *args, **kwargs):
        package = self.package
        super().delete(*args, **kwargs)
        # Update package rating after deletion
        self._update_package_rating_for(package)

    def _update_package_rating(self):
        """Update the package's average rating"""
        self._update_package_rating_for(self.package)

    @staticmethod
    def _update_package_rating_for(package):
        """Update average rating for a specific package"""
        from django.db.models import Avg
        avg_rating = package.reviews.aggregate(Avg('rating'))['rating__avg']
        package.rating = round(avg_rating, 1) if avg_rating else 0.0
        package.save(update_fields=['rating'])
