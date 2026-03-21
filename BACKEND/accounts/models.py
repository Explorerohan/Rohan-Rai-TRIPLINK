from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.validators import MaxValueValidator, MinValueValidator
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


def custom_package_image_path(instance, filename):
    """Generate file path for traveler custom package images"""
    if instance.pk:
        return f'custom_packages/{instance.user_id}/{instance.pk}/{filename}'
    return f'custom_packages/{instance.user_id}/temp/{filename}'


def chat_attachment_path(instance, filename):
    """Generate file path for chat message attachments (e.g. itinerary PDF)."""
    import uuid
    ext = filename.split('.')[-1] if '.' in filename else 'pdf'
    return f'chat_attachments/room_{instance.room_id}/{uuid.uuid4().hex[:12]}.{ext}'


class UserProfile(models.Model):
    """Profile model for Traveler users"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='user_profile')
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    profile_picture = models.ImageField(upload_to=user_profile_image_path, null=True, blank=True)
    # Simplified profile: single location field instead of multiple address fields
    location = models.CharField(max_length=200, blank=True, help_text="User location")
    reward_points = models.PositiveIntegerField(default=0, help_text="Points earned from completed trips (10% of booking total)")
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
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=0.0, help_text="Average rating from travelers (0-5)")
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

    @property
    def agent_rating(self):
        """Rating from the package's agent (from AgentProfile)"""
        try:
            return float(self.agent.agent_profile.rating)
        except (AgentProfile.DoesNotExist, AttributeError):
            return 0.0


class Deal(models.Model):
    """Time-limited percentage discount on a package. Agents create deals on their packages."""
    package = models.ForeignKey(
        Package,
        on_delete=models.CASCADE,
        related_name='deals',
    )
    agent = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='deals',
        limit_choices_to={'role': Roles.AGENT},
    )
    title = models.CharField(max_length=200, blank=True, help_text="Optional label, e.g. Summer Sale")
    discount_percent = models.PositiveIntegerField(
        help_text="Discount percentage 1-99, e.g. 20 for 20% off",
        validators=[MinValueValidator(1), MaxValueValidator(99)],
    )
    valid_from = models.DateTimeField(help_text="When deal becomes active")
    valid_until = models.DateTimeField(help_text="When deal expires")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Deal"
        verbose_name_plural = "Deals"
        ordering = ['-valid_until']

    def __str__(self):
        return f"{self.package.title} - {self.discount_percent}% off"

    def effective_price(self, base_price=None):
        """Compute price after discount. base_price defaults to package.price_per_person."""
        base = base_price if base_price is not None else self.package.price_per_person
        return (base * (100 - self.discount_percent)) / 100


def get_active_deal(package, now=None):
    """Return the active Deal for a package at the given time, or None."""
    from django.utils import timezone
    now = now or timezone.now()
    return (
        Deal.objects.filter(
            package=package,
            valid_from__lte=now,
            valid_until__gte=now,
        )
        .order_by('-valid_until')
        .first()
    )


class PackageBookmark(models.Model):
    """Traveler-saved packages (bookmarks)."""
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="package_bookmarks",
        limit_choices_to={"role": Roles.TRAVELER},
    )
    package = models.ForeignKey(
        Package,
        on_delete=models.CASCADE,
        related_name="bookmarks",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Package Bookmark"
        verbose_name_plural = "Package Bookmarks"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "package"], name="unique_traveler_package_bookmark")
        ]

    def __str__(self):
        return f"{self.user.email} -> {self.package.title}"


class CustomPackage(models.Model):
    """
    Custom trip package created by a traveler. Only visible to the user who created it.
    Same core fields as Package, plus additional_notes for "things to consider on this trip".
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="custom_packages",
        limit_choices_to={"role": Roles.TRAVELER},
    )
    title = models.CharField(max_length=200, help_text="Package title (e.g., PARIS)")
    location = models.CharField(max_length=200, help_text="Location name (e.g., Paris)")
    country = models.CharField(max_length=100, help_text="Country name (e.g., France)")
    description = models.TextField(help_text="Detailed description of the package")
    price_per_person = models.DecimalField(max_digits=10, decimal_places=2, help_text="Price in Rs.")
    duration_days = models.PositiveIntegerField(default=7, help_text="Number of days")
    duration_nights = models.PositiveIntegerField(default=6, help_text="Number of nights")
    trip_start_date = models.DateField(null=True, blank=True, help_text="Trip start date")
    trip_end_date = models.DateField(null=True, blank=True, help_text="Trip end date")
    main_image = models.ImageField(upload_to=custom_package_image_path, null=True, blank=True)
    features = models.ManyToManyField(PackageFeature, related_name="custom_packages", blank=True)
    additional_notes = models.TextField(
        blank=True,
        help_text="Additional things to consider on this trip (e.g., visa, weather, packing)",
    )

    # Claim / ownership fields for agents handling this custom request
    class CustomPackageStatus(models.TextChoices):
        OPEN = "open", "Open"
        CLAIMED = "claimed", "Claimed"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    claimed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="claimed_custom_packages",
        limit_choices_to={"role": Roles.AGENT},
        help_text="Agent who claimed / is handling this custom package",
    )
    status = models.CharField(
        max_length=20,
        choices=CustomPackageStatus.choices,
        default=CustomPackageStatus.OPEN,
        help_text="Lifecycle status for this custom package",
    )
    claimed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When an agent first claimed this custom package",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Custom Package"
        verbose_name_plural = "Custom Packages"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} (custom) - {self.user.email}"

    @property
    def duration_display(self):
        return f"{self.duration_days} Days / {self.duration_nights} Nights"


class BookingStatus(models.TextChoices):
    CONFIRMED = "confirmed", "Confirmed"
    CANCELLED = "cancelled", "Cancelled"


class PaymentMethod(models.TextChoices):
    ESEWA = "esewa", "eSewa"
    DIRECT = "direct", "Direct"


class PaymentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PAID = "paid", "Paid"
    FAILED = "failed", "Failed"
    REFUNDED = "refunded", "Refunded"


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
    traveler_count = models.PositiveIntegerField(default=1)
    price_per_person_snapshot = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.DIRECT,
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PAID,
    )
    payment_reference = models.CharField(max_length=120, blank=True)
    transaction_uuid = models.CharField(max_length=120, blank=True)
    rewards_awarded = models.BooleanField(default=False, help_text="Whether reward points (10% of total) have been credited for this completed trip")
    reward_points_given = models.PositiveIntegerField(
        default=0,
        help_text="Points awarded for this booking (10% of total). Used to prevent double-award and to deduct on delete.",
    )
    reward_points_used = models.PositiveIntegerField(
        default=0,
        help_text="Reward points redeemed/used as discount for this booking.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Booking"
        verbose_name_plural = "Bookings"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.email} – {self.package.title}"


class EsewaPaymentSessionStatus(models.TextChoices):
    INITIATED = "initiated", "Initiated"
    SUCCESS_REDIRECTED = "success_redirected", "Success Redirected"
    FAILED_REDIRECTED = "failed_redirected", "Failed Redirected"
    VERIFIED = "verified", "Verified"
    VERIFY_FAILED = "verify_failed", "Verify Failed"


class EsewaPaymentSession(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="esewa_payment_sessions",
        limit_choices_to={"role": Roles.TRAVELER},
    )
    package = models.ForeignKey(
        Package,
        on_delete=models.CASCADE,
        related_name="esewa_payment_sessions",
    )
    booking = models.OneToOneField(
        Booking,
        on_delete=models.SET_NULL,
        related_name="esewa_payment_session",
        null=True,
        blank=True,
    )
    transaction_uuid = models.CharField(max_length=120, unique=True)
    traveler_count = models.PositiveIntegerField(default=1)
    price_per_person_snapshot = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payable_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Amount to actually pay via eSewa after applying any reward points.",
    )
    reward_points_used = models.PositiveIntegerField(
        default=0,
        help_text="Reward points applied as discount for this payment session.",
    )
    product_code = models.CharField(max_length=80, default="EPAYTEST")
    status = models.CharField(
        max_length=32,
        choices=EsewaPaymentSessionStatus.choices,
        default=EsewaPaymentSessionStatus.INITIATED,
    )
    payment_reference = models.CharField(max_length=120, blank=True)
    esewa_status = models.CharField(max_length=40, blank=True)
    verification_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "eSewa Payment Session"
        verbose_name_plural = "eSewa Payment Sessions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.transaction_uuid} ({self.status})"


class AgentReview(models.Model):
    """Review left by a traveler for an agent after completing a trip with them"""
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="agent_reviews",
        limit_choices_to={"role": Roles.TRAVELER},
    )
    agent = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="reviews_received",
        limit_choices_to={"role": Roles.AGENT},
    )
    rating = models.PositiveIntegerField(help_text="Rating from 1 to 5")
    comment = models.TextField(blank=True, help_text="Review comment")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Agent Review"
        verbose_name_plural = "Agent Reviews"
        ordering = ["-created_at"]
        unique_together = ["user", "agent"]  # One review per traveler per agent

    def __str__(self):
        return f"{self.user.email} - {self.agent.email} ({self.rating}/5)"

    def save(self, *args, **kwargs):
        if self.rating < 1:
            self.rating = 1
        elif self.rating > 5:
            self.rating = 5
        super().save(*args, **kwargs)
        self._update_agent_rating()

    def delete(self, *args, **kwargs):
        agent_user = self.agent
        super().delete(*args, **kwargs)
        AgentReview._update_agent_rating_for(agent_user)

    def _update_agent_rating(self):
        AgentReview._update_agent_rating_for(self.agent)

    @staticmethod
    def _update_agent_rating_for(agent_user):
        """Update average rating on AgentProfile"""
        from django.db.models import Avg
        try:
            agent_profile = AgentProfile.objects.get(user=agent_user)
        except AgentProfile.DoesNotExist:
            return
        avg_rating = AgentReview.objects.filter(agent=agent_user).aggregate(Avg('rating'))['rating__avg']
        agent_profile.rating = round(avg_rating, 1) if avg_rating else 0.0
        agent_profile.save(update_fields=['rating'])


class ChatRoom(models.Model):
    """One-to-one chat room between a traveler and an agent."""
    traveler = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="chat_rooms_as_traveler",
        limit_choices_to={"role": Roles.TRAVELER},
    )
    agent = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="chat_rooms_as_agent",
        limit_choices_to={"role": Roles.AGENT},
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Chat Room"
        verbose_name_plural = "Chat Rooms"
        ordering = ["-updated_at"]
        unique_together = ["traveler", "agent"]

    def __str__(self):
        return f"Chat: {self.traveler.email} – {self.agent.email}"


class ChatMessage(models.Model):
    """A single message in a chat room. Optionally linked to a custom package or file attachment (e.g. itinerary PDF)."""
    room = models.ForeignKey(
        ChatRoom,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="chat_messages_sent",
    )
    text = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    custom_package = models.ForeignKey(
        CustomPackage,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_messages",
        help_text="When set, this message is about this custom package (show package card + message).",
    )
    attachment = models.FileField(
        upload_to=chat_attachment_path,
        null=True,
        blank=True,
        help_text="File attachment (e.g. itinerary PDF) sent with this message.",
    )

    class Meta:
        verbose_name = "Chat Message"
        verbose_name_plural = "Chat Messages"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.sender.email}: {self.text[:50]}..."


class ItineraryTrip(models.Model):
    """Groups a batch of itinerary items (e.g. 3 days 2 nights) for a chat room."""

    room = models.ForeignKey(
        ChatRoom,
        on_delete=models.CASCADE,
        related_name="itinerary_trips",
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="created_itinerary_trips",
        limit_choices_to={"role": Roles.AGENT},
    )
    start_date = models.DateField()
    days_count = models.PositiveSmallIntegerField(default=1)
    nights_count = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Itinerary Trip"
        verbose_name_plural = "Itinerary Trips"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Room {self.room_id} | {self.start_date} | {self.days_count}D/{self.nights_count}N"


class ItineraryItem(models.Model):
    """Structured itinerary item for a chat room, created by an agent. Can belong to an ItineraryTrip (day/night)."""

    room = models.ForeignKey(
        ChatRoom,
        on_delete=models.CASCADE,
        related_name="itinerary_items",
    )
    trip = models.ForeignKey(
        ItineraryTrip,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="items",
        help_text="When set, this item is part of a day/night trip batch.",
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="created_itinerary_items",
        limit_choices_to={"role": Roles.AGENT},
    )
    day_number = models.PositiveSmallIntegerField(
        default=1,
        help_text="1-based day index (Day 1, Day 2, etc.).",
    )
    is_night = models.BooleanField(
        default=False,
        help_text="True = Night period (e.g. Night 1), False = Day period.",
    )
    travel_date = models.DateField()
    day_label = models.CharField(max_length=50, blank=True, help_text="Day label, e.g. Day 1 / Monday")
    time_label = models.CharField(max_length=50, help_text="Time text, e.g. 09:00 AM")
    place = models.CharField(max_length=200)
    activity = models.CharField(max_length=300)
    food_name = models.CharField(max_length=150, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Itinerary Item"
        verbose_name_plural = "Itinerary Items"
        ordering = ["trip_id", "day_number", "is_night", "time_label", "created_at"]

    def __str__(self):
        period = f"Night {self.day_number}" if self.is_night else f"Day {self.day_number}"
        return f"{self.room_id} | {period} | {self.travel_date} {self.time_label} - {self.place}"


class NotificationType(models.TextChoices):
    ALERT = "alert", "Alert"
    EMERGENCY = "emergency", "Emergency"
    RULE_VIOLATION = "rule_violation", "Rule Violation"
    INFO = "info", "Information"
    UPDATE = "update", "Update"
    PROMOTION = "promotion", "Promotion"
    GENERAL = "general", "General"


class Notification(models.Model):
    """Notification sent by admin or agent to users."""
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=32,
        choices=NotificationType.choices,
        default=NotificationType.GENERAL,
        help_text="Type of notification - determines icon shown to user.",
    )
    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications_sent",
        help_text="Admin or agent who sent this notification.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} from {self.sender.email}"


class NotificationRecipient(models.Model):
    """Maps notifications to recipients and tracks read status."""
    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        related_name="recipients",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notification_recipients",
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Notification Recipient"
        verbose_name_plural = "Notification Recipients"
        ordering = ["-created_at"]
        unique_together = ["notification", "user"]

    def __str__(self):
        return f"{self.notification.title} -> {self.user.email}"


class ExpoPushToken(models.Model):
    """Expo push token for a user device (traveler/agent app). One row per device token."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="expo_push_tokens",
    )
    token = models.CharField(
        max_length=512,
        unique=True,
        help_text="ExponentPushToken[...] from expo-notifications",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Expo Push Token"
        verbose_name_plural = "Expo Push Tokens"
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.user.email} — {self.token[:40]}…"
