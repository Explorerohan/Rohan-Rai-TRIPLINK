from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import UserProfile, AgentProfile, Package, PackageFeature

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
    """Serializer for User (Traveler) Profile - simplified fields"""
    full_name = serializers.ReadOnlyField()
    email = serializers.EmailField(source='user.email', read_only=True)

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
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AgentProfileSerializer(serializers.ModelSerializer):
    """Serializer for Agent Profile - simplified fields"""
    full_name = serializers.ReadOnlyField()
    email = serializers.EmailField(source='user.email', read_only=True)

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
            'is_verified',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'is_verified', 'created_at', 'updated_at']


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
    
    class Meta:
        model = Package
        fields = [
            'id', 'title', 'location', 'country', 'description',
            'price_per_person', 'duration_days', 'duration_nights', 'duration_display',
            'main_image', 'main_image_url', 'features', 'status',
            'rating', 'participants_count', 'agent_name',
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
