import os
from django.core.exceptions import ImproperlyConfigured
from .base import *  # noqa: F401,F403

DEBUG = False

if not SECRET_KEY or len(SECRET_KEY) < 32:  # noqa: F405
    raise ImproperlyConfigured('DJANGO_SECRET_KEY must be at least 32 characters in production.')

if not FIELD_ENCRYPTION_KEY:  # noqa: F405
    raise ImproperlyConfigured('FIELD_ENCRYPTION_KEY must be configured in production.')

SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'True').lower() == 'true'
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
