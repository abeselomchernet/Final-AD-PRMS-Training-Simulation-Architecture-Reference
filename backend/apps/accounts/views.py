from datetime import timedelta
import hashlib
import secrets
from django.contrib.auth import authenticate
from django.core import signing
from django.utils import timezone
import pyotp
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.common.crypto import decrypt_secret, encrypt_secret, normalize_ethiopian_msisdn
from apps.notifications.sms_gateway import send_bilingual_sms
from .models import OtpChallenge, UserAccount
from .serializers import (
    StaffLoginSerializer,
    StaffMfaVerifySerializer,
    TenantOtpRequestSerializer,
    TenantOtpVerifySerializer,
    UserProfileSerializer,
)


def _hash_otp(msisdn: str, code: str) -> str:
    return hashlib.sha256(f'{msisdn}:{code}'.encode('utf-8')).hexdigest()


def _issue_jwt_pair(user: UserAccount) -> dict:
    refresh = RefreshToken.for_user(user)
    refresh['actor_id'] = user.actor_id
    refresh['role'] = user.role
    refresh['user_type'] = user.user_type
    refresh['owner_code'] = user.owner_code
    if user.tenant_id_ref:
        refresh['tenant_id'] = str(user.tenant_id_ref)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserProfileSerializer(user).data,
    }


class TenantOtpRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'otp_request'

    def post(self, request):
        ser = TenantOtpRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            msisdn = normalize_ethiopian_msisdn(ser.validated_data['msisdn'])
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        tenant_user = UserAccount.objects.filter(
            user_type=UserAccount.UserType.TENANT,
            phone_msisdn=msisdn,
            is_active=True,
        ).first()

        # Generic 200 prevents MSISDN enumeration while issuing real challenge only to registered tenants
        if tenant_user:
            code = f'{secrets.randbelow(900000) + 100000}'
            OtpChallenge.objects.create(
                msisdn=msisdn,
                otp_hash=_hash_otp(msisdn, code),
                expires_at=timezone.now() + timedelta(minutes=5),
            )
            locale = ser.validated_data['locale']
            body = (
                f'AD-PRMS Tenant Verification Code: {code}. Valid for 5 minutes.'
                if locale == 'en'
                else f'የAD-PRMS የተከራይ ማረጋገጫ ኮድ፡ {code}። ለ5 ደቂቃ ያገለግላል።'
            )
            send_bilingual_sms(msisdn=msisdn, body=body, owner_code=tenant_user.owner_code)

        return Response({'ok': True, 'detail': 'If this mobile number is registered, an OTP was sent.'})


class TenantOtpVerifyView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'otp_verify'

    def post(self, request):
        ser = TenantOtpVerifySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            msisdn = normalize_ethiopian_msisdn(ser.validated_data['msisdn'])
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        challenge = (
            OtpChallenge.objects.filter(msisdn=msisdn, consumed_at__isnull=True)
            .order_by('-created_at')
            .first()
        )
        if not challenge or challenge.is_expired or challenge.attempts >= challenge.max_attempts:
            return Response({'detail': 'OTP expired or locked. Request a new code.'}, status=status.HTTP_400_BAD_REQUEST)

        challenge.attempts += 1
        if challenge.otp_hash != _hash_otp(msisdn, ser.validated_data['code']):
            challenge.save(update_fields=['attempts'])
            return Response({'detail': 'Invalid verification code.'}, status=status.HTTP_400_BAD_REQUEST)

        challenge.consumed_at = timezone.now()
        challenge.save(update_fields=['attempts', 'consumed_at'])

        user = UserAccount.objects.filter(
            user_type=UserAccount.UserType.TENANT,
            phone_msisdn=msisdn,
            is_active=True,
        ).first()
        if not user:
            return Response({'detail': 'Tenant account inactive.'}, status=status.HTTP_403_FORBIDDEN)

        return Response(_issue_jwt_pair(user))


class StaffLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ser = StaffLoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = authenticate(
            request=request,
            username=ser.validated_data['username'],
            password=ser.validated_data['password'],
        )
        if not user or not user.is_active or user.user_type != UserAccount.UserType.STAFF:
            return Response({'detail': 'Invalid staff credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

        requested_owner = ser.validated_data.get('owner_code')
        if requested_owner and requested_owner in (user.allowed_owners or []):
            if user.role != 'Owner / Director':
                user.owner_code = requested_owner
                user.save(update_fields=['owner_code'])

        if user.mfa_enabled and user.mfa_secret_encrypted:
            challenge_token = signing.dumps({'uid': str(user.id)}, salt='adprms-staff-mfa')
            return Response({'mfa_required': True, 'mfa_challenge_token': challenge_token})

        return Response({'mfa_required': False, **_issue_jwt_pair(user)})


class StaffMfaSetupView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user: UserAccount = request.user
        if user.user_type != UserAccount.UserType.STAFF:
            return Response({'detail': 'Staff account required.'}, status=status.HTTP_403_FORBIDDEN)
        secret = pyotp.random_base32()
        user.mfa_secret_encrypted = encrypt_secret(secret)
        user.mfa_enabled = True
        user.save(update_fields=['mfa_secret_encrypted', 'mfa_enabled'])
        uri = pyotp.totp.TOTP(secret).provisioning_uri(name=user.username, issuer_name='AD-PRMS')
        return Response({'ok': True, 'provisioning_uri': uri})


class StaffMfaVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ser = StaffMfaVerifySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            payload = signing.loads(ser.validated_data['mfa_challenge_token'], salt='adprms-staff-mfa', max_age=300)
        except signing.BadSignature:
            return Response({'detail': 'MFA challenge expired or invalid.'}, status=status.HTTP_401_UNAUTHORIZED)

        user = UserAccount.objects.filter(id=payload['uid'], is_active=True).first()
        if not user or not user.mfa_secret_encrypted:
            return Response({'detail': 'MFA not configured.'}, status=status.HTTP_400_BAD_REQUEST)

        totp = pyotp.TOTP(decrypt_secret(user.mfa_secret_encrypted))
        if not totp.verify(ser.validated_data['totp_code'], valid_window=1):
            return Response({'detail': 'Invalid TOTP authenticator code.'}, status=status.HTTP_401_UNAUTHORIZED)

        return Response(_issue_jwt_pair(user))


class CurrentUserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserProfileSerializer(request.user).data)
