import os
from datetime import date
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import UserProfile, AgentProfile, Package, PackageFeature, PackageStatus, PackageBookmark, CustomPackage, Booking, BookingStatus, PaymentMethod, PaymentStatus, AgentReview, ChatRoom, ChatMessage, ItineraryItem, Notification, NotificationRecipient, Roles, get_active_deal
from .booking_cancellation import cancel_traveler_booking

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "role",
            "first_name",
            "last_name",
            "is_active",
            "is_staff",
            "date_joined",
        ]
        read_only_fields = ["id", "is_active", "is_staff", "date_joined"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=100)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=100)

    class Meta:
        model = User
        fields = ["email", "password", "role", "first_name", "last_name"]

    def create(self, validated_data):
        first_name = (validated_data.pop("first_name", "") or "").strip()
        last_name = (validated_data.pop("last_name", "") or "").strip()

        user = User.objects.create_user(**validated_data)

        # Keep names on auth user too so login payload can greet with first name
        # even before profile API finishes loading.
        if first_name or last_name:
            user.first_name = first_name
            user.last_name = last_name
            user.save(update_fields=["first_name", "last_name"])

        # Ensure traveler profile has names set from signup.
        # (Agents/admin-created users can manage their own profiles separately.)
        if user.role == Roles.TRAVELER:
            UserProfile.objects.update_or_create(
                user=user,
                defaults={"first_name": first_name, "last_name": last_name},
            )

        return user


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, attrs):
        new_password = attrs.get("new_password")
        confirm_new_password = attrs.get("confirm_new_password")
        if new_password != confirm_new_password:
            raise serializers.ValidationError(
                {"confirm_new_password": "New password and confirm password do not match."}
            )
        validate_password(new_password, self.context["request"].user)
        return attrs


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Attach role to JWT payload."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["email"] = user.email
        return token

    def validate(self, attrs):
        # Use parent validation; response includes refresh/access tokens
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for User (Traveler) Profile - simplified fields with picture"""
    full_name = serializers.ReadOnlyField()
    email = serializers.EmailField(source='user.email', read_only=True)
    profile_picture_url = serializers.SerializerMethodField()
    profile_picture = serializers.ImageField(required=False, allow_null=True)
    refund_qr_url = serializers.SerializerMethodField()
    refund_qr = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = UserProfile
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'phone_number',
            'location',
            'profile_picture',
            'profile_picture_url',
            'refund_qr',
            'refund_qr_url',
            'reward_points',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'reward_points', 'created_at', 'updated_at']

    def get_profile_picture_url(self, obj):
        if obj.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            return obj.profile_picture.url
        return None

    def get_refund_qr_url(self, obj):
        if obj.refund_qr:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.refund_qr.url)
            return obj.refund_qr.url
        return None

    def update(self, instance, validated_data):
        # Handle profile picture removal (when None is passed)
        if 'profile_picture' in validated_data and validated_data['profile_picture'] is None:
            if instance.profile_picture:
                instance.profile_picture.delete(save=False)
            validated_data['profile_picture'] = None
        if 'refund_qr' in validated_data and validated_data['refund_qr'] is None:
            if instance.refund_qr:
                instance.refund_qr.delete(save=False)
            validated_data['refund_qr'] = None
        return super().update(instance, validated_data)


class AgentProfileSerializer(serializers.ModelSerializer):
    """Serializer for Agent Profile - simplified fields with picture"""
    full_name = serializers.ReadOnlyField()
    email = serializers.EmailField(source='user.email', read_only=True)
    profile_picture_url = serializers.SerializerMethodField()
    profile_picture = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = AgentProfile
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'phone_number',
            'location',
            'profile_picture',
            'profile_picture_url',
            'is_verified',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'is_verified', 'created_at', 'updated_at']

    def get_profile_picture_url(self, obj):
        if obj.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            return obj.profile_picture.url
        return None

    def update(self, instance, validated_data):
        # Handle profile picture removal (when None is passed)
        if 'profile_picture' in validated_data and validated_data['profile_picture'] is None:
            if instance.profile_picture:
                instance.profile_picture.delete(save=False)
            validated_data['profile_picture'] = None
        return super().update(instance, validated_data)


class PackageFeatureSerializer(serializers.ModelSerializer):
    """Serializer for Package Features"""
    class Meta:
        model = PackageFeature
        fields = ['id', 'name', 'icon', 'description']


class CustomPackageSerializer(serializers.ModelSerializer):
    """Serializer for traveler-created custom packages (private to owner)."""
    features = PackageFeatureSerializer(many=True, read_only=True)
    main_image_url = serializers.SerializerMethodField()
    duration_display = serializers.ReadOnlyField()
    status = serializers.CharField(required=False)
    claimed_by_name = serializers.SerializerMethodField()
    claimed_by_id = serializers.IntegerField(source="claimed_by.id", read_only=True)
    feature_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=PackageFeature.objects.all(), write_only=True, required=False
    )

    class Meta:
        model = CustomPackage
        fields = [
            'id', 'title', 'location', 'country', 'description',
            'price_per_person', 'duration_days', 'duration_nights', 'duration_display',
            'trip_start_date', 'trip_end_date',
            'main_image', 'main_image_url', 'features', 'feature_ids',
            'additional_notes',
            'status', 'claimed_by_id', 'claimed_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_main_image_url(self, obj):
        if obj.main_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.main_image.url)
            return obj.main_image.url
        return None

    def create(self, validated_data):
        feature_ids = validated_data.pop('feature_ids', [])
        user = validated_data.get('user') or self.context.get('request').user
        validated_data['user'] = user
        instance = super().create(validated_data)
        if feature_ids:
            instance.features.set(feature_ids)
        return instance

    def validate_status(self, value):
        """Traveler may only set status to 'cancelled'. Other transitions are server/agent-only."""
        if value is None:
            return value
        v = (value or "").strip().lower()
        if v and v != CustomPackage.CustomPackageStatus.CANCELLED:
            raise serializers.ValidationError("You can only cancel this package. Use status: cancelled.")
        return v or None

    def update(self, instance, validated_data):
        feature_ids = validated_data.pop('feature_ids', None)
        new_status = validated_data.pop('status', None)
        if new_status == CustomPackage.CustomPackageStatus.CANCELLED:
            # Enforce: traveler can only cancel at least 2 days before trip start.
            start = instance.trip_start_date
            if start:
                days_diff = (start - date.today()).days
                if days_diff < 2:
                    raise serializers.ValidationError({
                        "status": "You can only cancel this custom package at least 2 days before the trip start date."
                    })
            instance.status = CustomPackage.CustomPackageStatus.CANCELLED
            instance.save(update_fields=["status", "updated_at"])
        super().update(instance, validated_data)
        if feature_ids is not None:
            instance.features.set(feature_ids)
        return instance

    def get_claimed_by_name(self, obj):
        """Human-friendly name for the agent who claimed this custom package."""
        claimed_by = getattr(obj, "claimed_by", None)
        if not claimed_by:
            return None
        try:
            if claimed_by.role == Roles.AGENT and hasattr(claimed_by, "agent_profile"):
                return claimed_by.agent_profile.full_name
        except Exception:
            pass
        return claimed_by.email.split("@")[0]


class PackageSerializer(serializers.ModelSerializer):
    """Serializer for Packages"""
    features = PackageFeatureSerializer(many=True, read_only=True)
    main_image_url = serializers.SerializerMethodField()
    agent_name = serializers.SerializerMethodField()
    agent_rating = serializers.SerializerMethodField()
    duration_display = serializers.ReadOnlyField()
    user_has_booked = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    participants_preview = serializers.SerializerMethodField()
    has_active_deal = serializers.SerializerMethodField()
    deal_discount_percent = serializers.SerializerMethodField()
    original_price = serializers.SerializerMethodField()
    deal_price = serializers.SerializerMethodField()

    class Meta:
        model = Package
        fields = [
            'id', 'title', 'location', 'country', 'latitude', 'longitude', 'description',
            'price_per_person', 'duration_days', 'duration_nights', 'duration_display',
            'trip_start_date', 'trip_end_date',
            'main_image', 'main_image_url', 'features', 'status',
            'agent_rating', 'participants_count', 'participants_preview', 'agent_name', 'user_has_booked', 'is_bookmarked',
            'has_active_deal', 'deal_discount_percent', 'original_price', 'deal_price',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_participants_preview(self, obj):
        """Up to 5 participants with profile picture URL for list/card preview."""
        bookings = obj.bookings.filter(status=BookingStatus.CONFIRMED)[:5]
        out = []
        for booking in bookings:
            try:
                profile = booking.user.user_profile
                url = None
                if profile.profile_picture:
                    request = self.context.get('request')
                    url = request.build_absolute_uri(profile.profile_picture.url) if request else profile.profile_picture.url
            except UserProfile.DoesNotExist:
                url = None
            out.append({'profile_picture_url': url})
        return out

    def get_main_image_url(self, obj):
        if obj.main_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.main_image.url)
            return obj.main_image.url
        return None
    
    def get_agent_name(self, obj):
        try:
            agent_profile = obj.agent.agent_profile
            return agent_profile.full_name
        except:
            return obj.agent.email.split('@')[0]

    def get_agent_rating(self, obj):
        try:
            return float(obj.agent.agent_profile.rating)
        except (AgentProfile.DoesNotExist, AttributeError):
            return 0.0
    
    def get_user_has_booked(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated or getattr(request.user, 'role', None) != 'traveler':
            return False
        return Booking.objects.filter(
            user=request.user, package=obj, status=BookingStatus.CONFIRMED
        ).exists()

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated or getattr(request.user, 'role', None) != 'traveler':
            return False
        bookmarked_ids = self.context.get("bookmarked_package_ids")
        if bookmarked_ids is not None:
            try:
                return obj.id in bookmarked_ids
            except TypeError:
                pass
        return PackageBookmark.objects.filter(user=request.user, package=obj).exists()

    def _get_deal_info(self, obj):
        deal = get_active_deal(obj)
        if not deal:
            return False, None, None, None
        return True, deal.discount_percent, obj.price_per_person, deal.effective_price()

    def get_has_active_deal(self, obj):
        return self._get_deal_info(obj)[0]

    def get_deal_discount_percent(self, obj):
        return self._get_deal_info(obj)[1]

    def get_original_price(self, obj):
        return self._get_deal_info(obj)[2]

    def get_deal_price(self, obj):
        return self._get_deal_info(obj)[3]


class BookingSerializer(serializers.ModelSerializer):
    """Serializer for Bookings - create and list. Use package_id for create (no duplicate package field)."""
    package_title = serializers.CharField(source='package.title', read_only=True)
    package_id = serializers.PrimaryKeyRelatedField(
        queryset=Package.objects.filter(status=PackageStatus.ACTIVE),
        source='package',
    )
    package_image_url = serializers.SerializerMethodField()
    package_location = serializers.CharField(source='package.location', read_only=True)
    package_country = serializers.CharField(source='package.country', read_only=True)
    trip_start_date = serializers.DateField(source='package.trip_start_date', read_only=True)
    trip_end_date = serializers.DateField(source='package.trip_end_date', read_only=True)
    package_status = serializers.CharField(source='package.status', read_only=True)
    traveler_count = serializers.IntegerField(required=False, min_value=1)

    class Meta:
        model = Booking
        fields = [
            'id', 'user', 'package_id', 'package_title', 'status', 'created_at',
            'traveler_count', 'price_per_person_snapshot', 'total_amount',
            'payment_method', 'payment_status', 'payment_reference', 'transaction_uuid',
            'refunded_at', 'esewa_refund_reference',
            'package_image_url', 'package_location', 'package_country',
            'trip_start_date', 'trip_end_date', 'package_status',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'refunded_at', 'esewa_refund_reference']

    def get_package_image_url(self, obj):
        pkg = obj.package
        if pkg and pkg.main_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(pkg.main_image.url)
            return pkg.main_image.url
        return None

    def create(self, validated_data):
        user = self.context['request'].user
        package = validated_data.pop('package')
        traveler_count = int(validated_data.pop('traveler_count', 1) or 1)
        validated_data.pop('payment_reference', None)
        validated_data.pop('transaction_uuid', None)
        validated_data.pop('payment_method', None)
        validated_data.pop('payment_status', None)
        validated_data.pop('price_per_person_snapshot', None)
        validated_data.pop('total_amount', None)
        if Booking.objects.filter(user=user, package=package, status=BookingStatus.CONFIRMED).exists():
            raise serializers.ValidationError({'package_id': 'You have already booked this package.'})
        # Always create as confirmed; ignore any incoming status. Apply deal price if active.
        active_deal = get_active_deal(package)
        if active_deal:
            price_per_person = active_deal.effective_price() or 0
        else:
            price_per_person = package.price_per_person or 0
        total_amount = price_per_person * traveler_count
        validated_data['user'] = user
        validated_data['package'] = package
        validated_data['status'] = BookingStatus.CONFIRMED
        validated_data['traveler_count'] = traveler_count
        validated_data['price_per_person_snapshot'] = price_per_person
        validated_data['total_amount'] = total_amount
        validated_data['payment_method'] = PaymentMethod.DIRECT
        validated_data['payment_status'] = PaymentStatus.PAID
        booking = super().create(validated_data)
        package.participants_count = (package.participants_count or 0) + traveler_count
        package.save(update_fields=['participants_count'])
        return booking

    def validate_status(self, value):
        """
        Travelers can only transition a booking to 'cancelled' via the API.
        Other status transitions are handled by the server/agent.
        """
        if value is None:
            return value
        v = (value or "").strip().lower()
        if v and v != BookingStatus.CANCELLED:
            raise serializers.ValidationError("You can only cancel a booking (status: cancelled).")
        return v or None

    def update(self, instance, validated_data):
        """
        Support traveler cancellation with a 2-day cutoff before trip_start_date,
        reward-point restoration, and eSewa refund bookkeeping (see booking_cancellation).
        """
        new_status = validated_data.get('status')
        if new_status != BookingStatus.CANCELLED:
            raise serializers.ValidationError({
                "status": "Only cancellation is supported for bookings."
            })
        cancel_traveler_booking(instance)
        instance.refresh_from_db()
        return instance


class AgentReviewSerializer(serializers.ModelSerializer):
    """Serializer for Agent Reviews"""
    reviewer_name = serializers.SerializerMethodField()
    reviewer_profile_picture = serializers.SerializerMethodField()

    class Meta:
        model = AgentReview
        fields = [
            'id', 'user', 'agent', 'rating', 'comment',
            'reviewer_name', 'reviewer_profile_picture',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'agent', 'created_at', 'updated_at']

    def get_reviewer_name(self, obj):
        try:
            profile = obj.user.user_profile
            return profile.full_name
        except UserProfile.DoesNotExist:
            return obj.user.email.split('@')[0]

    def get_reviewer_profile_picture(self, obj):
        try:
            profile = obj.user.user_profile
            if profile.profile_picture:
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(profile.profile_picture.url)
                return profile.profile_picture.url
        except UserProfile.DoesNotExist:
            pass
        return None

    def create(self, validated_data):
        from datetime import date
        user = self.context['request'].user
        agent = validated_data.get('agent')

        # Traveler can only review agent after trip has completed (package status completed = trip end date passed)
        has_booking = Booking.objects.filter(
            user=user,
            package__agent=agent,
            status=BookingStatus.CONFIRMED
        ).exists()
        if not has_booking:
            raise serializers.ValidationError(
                {'agent': 'You can only review agents after completing a trip with them.'}
            )

        has_completed_trip = Booking.objects.filter(
            user=user,
            package__agent=agent,
            package__status=PackageStatus.COMPLETED,
            package__trip_end_date__isnull=False,
            package__trip_end_date__lte=date.today(),
            status=BookingStatus.CONFIRMED
        ).exists()
        if not has_completed_trip:
            raise serializers.ValidationError(
                {'agent': 'You can only review after the trip is completed (trip end date has passed).'}
            )

        if AgentReview.objects.filter(user=user, agent=agent).exists():
            raise serializers.ValidationError(
                {'agent': 'You have already reviewed this agent.'}
            )

        validated_data['user'] = user
        return super().create(validated_data)


class ParticipantSerializer(serializers.ModelSerializer):
    """Serializer for showing participants (travelers who booked)"""
    traveler_name = serializers.SerializerMethodField()
    traveler_profile_picture = serializers.SerializerMethodField()
    traveler_location = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = ['id', 'traveler_name', 'traveler_profile_picture', 'traveler_location', 'created_at']

    def get_traveler_name(self, obj):
        try:
            profile = obj.user.user_profile
            return profile.full_name
        except UserProfile.DoesNotExist:
            return obj.user.email.split('@')[0]

    def get_traveler_profile_picture(self, obj):
        try:
            profile = obj.user.user_profile
            if profile.profile_picture:
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(profile.profile_picture.url)
                return profile.profile_picture.url
        except UserProfile.DoesNotExist:
            pass
        return None

    def get_traveler_location(self, obj):
        try:
            profile = obj.user.user_profile
            return profile.location
        except UserProfile.DoesNotExist:
            return None


class AgentInfoSerializer(serializers.ModelSerializer):
    """Serializer for agent info in package detail."""
    full_name = serializers.ReadOnlyField()
    profile_picture_url = serializers.SerializerMethodField()
    agent_id = serializers.SerializerMethodField()
    rating = serializers.DecimalField(max_digits=3, decimal_places=1, read_only=True)

    class Meta:
        model = AgentProfile
        fields = [
            'id', 'agent_id', 'full_name', 'phone_number', 'location',
            'profile_picture_url', 'is_verified', 'rating'
        ]

    def get_profile_picture_url(self, obj):
        if obj.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            return obj.profile_picture.url
        return None

    def get_agent_id(self, obj):
        return obj.user_id


class PublicAgentDetailSerializer(serializers.ModelSerializer):
    """Public agent profile details for traveler-facing profile popup."""
    full_name = serializers.ReadOnlyField()
    email = serializers.EmailField(source='user.email', read_only=True)
    profile_picture_url = serializers.SerializerMethodField()
    agent_id = serializers.SerializerMethodField()
    rating = serializers.DecimalField(max_digits=3, decimal_places=1, read_only=True)
    reviews = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()
    total_packages_created = serializers.SerializerMethodField()
    total_bookings_handled = serializers.SerializerMethodField()

    class Meta:
        model = AgentProfile
        fields = [
            'id',
            'agent_id',
            'full_name',
            'email',
            'phone_number',
            'location',
            'profile_picture_url',
            'is_verified',
            'rating',
            'reviews_count',
            'total_packages_created',
            'total_bookings_handled',
            'reviews',
        ]

    def get_profile_picture_url(self, obj):
        if obj.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            return obj.profile_picture.url
        return None

    def get_agent_id(self, obj):
        return obj.user_id

    def get_reviews(self, obj):
        reviews = AgentReview.objects.filter(agent=obj.user).order_by('-created_at')[:10]
        return AgentReviewSerializer(reviews, many=True, context=self.context).data

    def get_reviews_count(self, obj):
        return AgentReview.objects.filter(agent=obj.user).count()

    def get_total_packages_created(self, obj):
        return Package.objects.filter(agent=obj.user).count()

    def get_total_bookings_handled(self, obj):
        return Booking.objects.filter(
            package__agent=obj.user,
            status=BookingStatus.CONFIRMED,
        ).count()


class PackageDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for Package with agent info and participants."""
    features = PackageFeatureSerializer(many=True, read_only=True)
    main_image_url = serializers.SerializerMethodField()
    duration_display = serializers.ReadOnlyField()
    user_has_booked = serializers.SerializerMethodField()
    agent_rating = serializers.SerializerMethodField()
    has_active_deal = serializers.SerializerMethodField()
    deal_discount_percent = serializers.SerializerMethodField()
    original_price = serializers.SerializerMethodField()
    deal_price = serializers.SerializerMethodField()

    # Nested data
    agent = serializers.SerializerMethodField()
    participants = serializers.SerializerMethodField()

    class Meta:
        model = Package
        fields = [
            'id', 'title', 'location', 'country', 'latitude', 'longitude', 'description',
            'price_per_person', 'duration_days', 'duration_nights', 'duration_display',
            'trip_start_date', 'trip_end_date',
            'main_image', 'main_image_url', 'features', 'status',
            'agent_rating', 'participants_count',
            'user_has_booked',
            'has_active_deal', 'deal_discount_percent', 'original_price', 'deal_price',
            'agent', 'participants',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_main_image_url(self, obj):
        if obj.main_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.main_image.url)
            return obj.main_image.url
        return None

    def get_user_has_booked(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated or getattr(request.user, 'role', None) != 'traveler':
            return False
        return Booking.objects.filter(
            user=request.user, package=obj, status=BookingStatus.CONFIRMED
        ).exists()

    def get_agent_rating(self, obj):
        try:
            return float(obj.agent.agent_profile.rating)
        except (AgentProfile.DoesNotExist, AttributeError):
            return 0.0

    def _get_deal_info_detail(self, obj):
        deal = get_active_deal(obj)
        if not deal:
            return False, None, None, None
        return True, deal.discount_percent, obj.price_per_person, deal.effective_price()

    def get_has_active_deal(self, obj):
        return self._get_deal_info_detail(obj)[0]

    def get_deal_discount_percent(self, obj):
        return self._get_deal_info_detail(obj)[1]

    def get_original_price(self, obj):
        return self._get_deal_info_detail(obj)[2]

    def get_deal_price(self, obj):
        return self._get_deal_info_detail(obj)[3]

    def get_agent(self, obj):
        try:
            agent_profile = obj.agent.agent_profile
            return AgentInfoSerializer(agent_profile, context=self.context).data
        except AgentProfile.DoesNotExist:
            return {
                'id': None,
                'agent_id': obj.agent_id,
                'full_name': obj.agent.email.split('@')[0],
                'phone_number': None,
                'location': None,
                'profile_picture_url': None,
                'is_verified': False,
                'rating': 0.0,
            }

    def get_participants(self, obj):
        bookings = obj.bookings.filter(status=BookingStatus.CONFIRMED)[:20]  # Limit to 20 participants
        return ParticipantSerializer(bookings, many=True, context=self.context).data


# ---- Chat serializers ----

def _user_display_name(user):
    """Get display name for a user (traveler or agent)."""
    try:
        if user.role == Roles.TRAVELER and hasattr(user, "user_profile"):
            return user.user_profile.full_name
        if user.role == Roles.AGENT and hasattr(user, "agent_profile"):
            return user.agent_profile.full_name
    except Exception:
        pass
    return user.email.split("@")[0]


def _user_avatar_url(user, request):
    """Get profile picture URL for a user."""
    try:
        if user.role == Roles.TRAVELER and hasattr(user, "user_profile"):
            profile = user.user_profile
        elif user.role == Roles.AGENT and hasattr(user, "agent_profile"):
            profile = user.agent_profile
        else:
            return None
        if profile.profile_picture:
            return request.build_absolute_uri(profile.profile_picture.url) if request else profile.profile_picture.url
    except Exception:
        pass
    return None


_MAX_CHAT_ATTACHMENT_BYTES = 15 * 1024 * 1024  # 15 MB


class ChatMessageSerializer(serializers.ModelSerializer):
    """Serializer for chat messages. Room and sender are set by the view on create."""
    sender_id = serializers.IntegerField(source="sender.id", read_only=True)
    sender_name = serializers.SerializerMethodField()
    custom_package_detail = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()
    attachment_name = serializers.SerializerMethodField()
    attachment = serializers.FileField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = ChatMessage
        fields = [
            "id",
            "room",
            "sender_id",
            "sender_name",
            "text",
            "is_read",
            "created_at",
            "custom_package_detail",
            "attachment_url",
            "attachment_name",
            "attachment",
        ]
        read_only_fields = [
            "id",
            "room",
            "sender_id",
            "sender_name",
            "is_read",
            "created_at",
            "custom_package_detail",
            "attachment_url",
            "attachment_name",
        ]
        extra_kwargs = {
            "text": {"required": False, "allow_blank": True},
        }

    def get_attachment_url(self, obj):
        if not obj.attachment:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.attachment.url)
        return obj.attachment.url

    def get_attachment_name(self, obj):
        if not obj.attachment:
            return None
        import os

        return os.path.basename(getattr(obj.attachment, "name", "") or "")

    def validate_attachment(self, value):
        if value and value.size > _MAX_CHAT_ATTACHMENT_BYTES:
            raise serializers.ValidationError("File is too large (maximum 15 MB).")
        return value

    def validate(self, attrs):
        text = (attrs.get("text") or "").strip()
        file_obj = attrs.get("attachment")
        if not text and not file_obj:
            raise serializers.ValidationError("Provide message text and/or attach a file.")
        attrs["text"] = text
        return attrs

    def get_sender_name(self, obj):
        return _user_display_name(obj.sender)

    def get_custom_package_detail(self, obj):
        pkg = getattr(obj, "custom_package", None)
        if not pkg:
            return None
        request = self.context.get("request")
        image_url = None
        if pkg.main_image:
            image_url = request.build_absolute_uri(pkg.main_image.url) if request else pkg.main_image.url
        return {
            "id": pkg.id,
            "title": pkg.title,
            "location": f"{pkg.location}, {pkg.country}",
            "image_url": image_url,
        }

    def create(self, validated_data):
        room = validated_data.pop("room", None)
        sender = validated_data.pop("sender", None)
        custom_package = validated_data.pop("custom_package", None)
        if not room or not sender:
            raise serializers.ValidationError("room and sender required")
        return ChatMessage.objects.create(room=room, sender=sender, custom_package=custom_package, **validated_data)


class ChatRoomSerializer(serializers.ModelSerializer):
    """Serializer for chat rooms - includes other participant info and last message preview."""
    other_user_id = serializers.SerializerMethodField()
    other_user_name = serializers.SerializerMethodField()
    other_user_avatar = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    last_message_at = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = [
            "id",
            "traveler",
            "agent",
            "other_user_id",
            "other_user_name",
            "other_user_avatar",
            "last_message",
            "last_message_at",
            "unread_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._last_message_row_cache = {}

    def _get_last_message_row(self, obj):
        pk = obj.pk
        if pk not in self._last_message_row_cache:
            self._last_message_row_cache[pk] = (
                obj.messages.order_by("-created_at").select_related("sender").first()
            )
        return self._last_message_row_cache[pk]

    @staticmethod
    def _attachment_is_image(attachment_field):
        if not attachment_field:
            return False
        name = os.path.basename(attachment_field.name).lower()
        ext = os.path.splitext(name)[1].lstrip(".")
        return ext in ("jpg", "jpeg", "png", "gif", "webp")

    def _get_other_user(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        user = request.user
        if user == obj.traveler:
            return obj.agent
        if user == obj.agent:
            return obj.traveler
        return None

    def get_other_user_id(self, obj):
        other = self._get_other_user(obj)
        return other.id if other else None

    def get_other_user_name(self, obj):
        other = self._get_other_user(obj)
        return _user_display_name(other) if other else None

    def get_other_user_avatar(self, obj):
        other = self._get_other_user(obj)
        if not other:
            return None
        request = self.context.get("request")
        return _user_avatar_url(other, request)

    def get_last_message(self, obj):
        last = self._get_last_message_row(obj)
        if not last:
            return None
        text = (last.text or "").strip()
        if text:
            return text[:100] + ("..." if len(text) > 100 else "")
        if last.attachment:
            if self._attachment_is_image(last.attachment):
                request = self.context.get("request")
                viewer = request.user if request and request.user.is_authenticated else None
                sender = last.sender
                if viewer and sender == viewer:
                    preview = "You sent an image."
                elif sender == obj.traveler:
                    preview = f"{_user_display_name(obj.traveler)} sent an image."
                else:
                    preview = f"{_user_display_name(obj.agent)} sent an image."
                return preview[:100] + ("..." if len(preview) > 100 else "")
            name = os.path.basename(last.attachment.name)
            preview = f"📎 {name}" if name else "📎 Attachment"
            return preview[:100] + ("..." if len(preview) > 100 else "")
        return None

    def get_last_message_at(self, obj):
        last = self._get_last_message_row(obj)
        return last.created_at.isoformat() if last else obj.updated_at.isoformat()

    def get_unread_count(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return 0
        user = request.user
        return obj.messages.filter(is_read=False).exclude(sender=user).count()


class ItineraryItemSerializer(serializers.ModelSerializer):
    """Serializer for chat itinerary items."""

    created_by_id = serializers.IntegerField(source="created_by.id", read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ItineraryItem
        fields = [
            "id",
            "room",
            "trip",
            "day_number",
            "is_night",
            "created_by_id",
            "created_by_name",
            "travel_date",
            "day_label",
            "time_label",
            "place",
            "activity",
            "food_name",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "room", "created_by_id", "created_by_name", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        return _user_display_name(obj.created_by)


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for notifications received by the current user."""
    sender_name = serializers.SerializerMethodField()
    is_read = serializers.SerializerMethodField()
    recipient_id = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ["id", "title", "message", "notification_type", "sender", "sender_name", "is_read", "recipient_id", "created_at"]
        read_only_fields = ["id", "sender", "created_at"]

    def get_sender_name(self, obj):
        try:
            if obj.sender.role == "admin":
                return "TRIPLINK Admin"
            if hasattr(obj.sender, "agent_profile"):
                return obj.sender.agent_profile.full_name or obj.sender.email
            return obj.sender.email
        except Exception:
            return obj.sender.email

    def get_is_read(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        try:
            recip = NotificationRecipient.objects.get(notification=obj, user=request.user)
            return recip.is_read
        except NotificationRecipient.DoesNotExist:
            return False

    def get_recipient_id(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        try:
            recip = NotificationRecipient.objects.get(notification=obj, user=request.user)
            return recip.id
        except NotificationRecipient.DoesNotExist:
            return None


class NotificationCreateSerializer(serializers.Serializer):
    """Serializer for creating notifications (admin/agent only)."""
    title = serializers.CharField(max_length=200)
    message = serializers.CharField()
    notification_type = serializers.ChoiceField(
        choices=[
            ("alert", "Alert"),
            ("emergency", "Emergency"),
            ("rule_violation", "Rule Violation"),
            ("info", "Information"),
            ("update", "Update"),
            ("promotion", "Promotion"),
            ("general", "General"),
        ],
        default="general",
        required=False,
    )
    target_type = serializers.ChoiceField(
        choices=[
            ("all_travelers", "All travelers"),
            ("all_users", "All users"),
            ("my_travelers", "My travelers (agent only)"),
            ("specific", "Specific users"),
        ]
    )
    user_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        help_text="Required when target_type is 'specific'. User IDs to send to.",
    )


class ExpoPushTokenRegisterSerializer(serializers.Serializer):
    """Register or update this device's Expo push token for the current user."""

    expo_push_token = serializers.CharField(max_length=512, trim_whitespace=True)

    def validate_expo_push_token(self, value):
        v = (value or "").strip()
        if not v.startswith("ExponentPushToken["):
            raise serializers.ValidationError("Invalid Expo push token format.")
        return v
