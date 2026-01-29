from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import UserProfile, AgentProfile, Package, PackageFeature, PackageStatus, Booking, BookingStatus

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "role", "is_active", "is_staff", "date_joined"]
        read_only_fields = ["id", "is_active", "is_staff", "date_joined"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["email", "password", "role"]

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


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
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

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


class PackageSerializer(serializers.ModelSerializer):
    """Serializer for Packages"""
    features = PackageFeatureSerializer(many=True, read_only=True)
    main_image_url = serializers.SerializerMethodField()
    agent_name = serializers.SerializerMethodField()
    duration_display = serializers.ReadOnlyField()
    user_has_booked = serializers.SerializerMethodField()
    
    class Meta:
        model = Package
        fields = [
            'id', 'title', 'location', 'country', 'description',
            'price_per_person', 'duration_days', 'duration_nights', 'duration_display',
            'main_image', 'main_image_url', 'features', 'status',
            'rating', 'participants_count', 'agent_name', 'user_has_booked',
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
    
    def get_agent_name(self, obj):
        try:
            agent_profile = obj.agent.agent_profile
            return agent_profile.full_name
        except:
            return obj.agent.email.split('@')[0]
    
    def get_user_has_booked(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated or getattr(request.user, 'role', None) != 'traveler':
            return False
        return Booking.objects.filter(
            user=request.user, package=obj, status=BookingStatus.CONFIRMED
        ).exists()


class BookingSerializer(serializers.ModelSerializer):
    """Serializer for Bookings - create and list. Use package_id for create (no duplicate package field)."""
    package_title = serializers.CharField(source='package.title', read_only=True)
    package_id = serializers.PrimaryKeyRelatedField(
        queryset=Package.objects.filter(status=PackageStatus.ACTIVE),
        source='package',
    )

    class Meta:
        model = Booking
        fields = ['id', 'user', 'package_id', 'package_title', 'status', 'created_at']
        read_only_fields = ['id', 'user', 'status', 'created_at']

    def create(self, validated_data):
        user = self.context['request'].user
        package = validated_data.pop('package')
        if Booking.objects.filter(user=user, package=package, status=BookingStatus.CONFIRMED).exists():
            raise serializers.ValidationError({'package_id': 'You have already booked this package.'})
        validated_data['user'] = user
        validated_data['package'] = package
        booking = super().create(validated_data)
        package.participants_count = (package.participants_count or 0) + 1
        package.save(update_fields=['participants_count'])
        return booking
