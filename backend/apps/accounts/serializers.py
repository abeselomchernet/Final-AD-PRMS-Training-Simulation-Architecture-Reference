from rest_framework import serializers
from .models import UserAccount


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAccount
        fields = (
            'id',
            'username',
            'actor_id',
            'user_type',
            'role',
            'phone_msisdn',
            'owner_code',
            'allowed_owners',
            'tenant_id_ref',
            'mfa_enabled',
            'preferred_locale',
        )
        read_only_fields = fields


class TenantOtpRequestSerializer(serializers.Serializer):
    msisdn = serializers.CharField(max_length=24)
    locale = serializers.ChoiceField(choices=('en', 'am'), default='en')


class TenantOtpVerifySerializer(serializers.Serializer):
    msisdn = serializers.CharField(max_length=24)
    code = serializers.RegexField(regex=r'^\d{6}$')


class StaffLoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)
    owner_code = serializers.CharField(max_length=32, required=False)


class StaffMfaVerifySerializer(serializers.Serializer):
    mfa_challenge_token = serializers.CharField()
    totp_code = serializers.RegexField(regex=r'^\d{6}$')
