from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CurrentUserProfileView,
    StaffLoginView,
    StaffMfaSetupView,
    StaffMfaVerifyView,
    TenantOtpRequestView,
    TenantOtpVerifyView,
)

urlpatterns = [
    path('me/', CurrentUserProfileView.as_view(), name='auth-me'),
    path('tenant/otp/request/', TenantOtpRequestView.as_view(), name='tenant-otp-request'),
    path('tenant/otp/verify/', TenantOtpVerifyView.as_view(), name='tenant-otp-verify'),
    path('staff/login/', StaffLoginView.as_view(), name='staff-login'),
    path('staff/mfa/setup/', StaffMfaSetupView.as_view(), name='staff-mfa-setup'),
    path('staff/mfa/verify/', StaffMfaVerifyView.as_view(), name='staff-mfa-verify'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
]
