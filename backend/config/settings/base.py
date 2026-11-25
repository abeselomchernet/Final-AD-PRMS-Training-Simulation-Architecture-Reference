from datetime import timedelta
import os
import secrets
import sys
from pathlib import Path
from urllib.parse import urlparse
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent.parent

_IS_TEST_OR_DEV = (
    'pytest' in sys.modules
    or (len(sys.argv) > 1 and sys.argv[1] == 'test')
    or os.environ.get('DJANGO_ENV', '').lower() in ('dev', 'test')
    or os.environ.get('DJANGO_SETTINGS_MODULE', '') == 'config.settings.dev'
)

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '').strip()
if not SECRET_KEY:
    if _IS_TEST_OR_DEV:
        SECRET_KEY = secrets.token_urlsafe(48)
    else:
        raise ImproperlyConfigured('DJANGO_SECRET_KEY environment variable is required.')

DEBUG = os.environ.get('DJANGO_DEBUG', 'False').lower() == 'true'
ALLOWED_HOSTS = [h.strip() for h in os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if h.strip()]
if DEBUG and '*' in ALLOWED_HOSTS:
    raise ImproperlyConfigured("ALLOWED_HOSTS cannot contain '*' when DEBUG is True.")

INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'django_filters',
    'channels',
    'django_celery_beat',
    'storages',
    'apps.accounts',
    'apps.portfolio',
    'apps.billing',
    'apps.gateways',
    'apps.documents',
    'apps.maintenance',
    'apps.notifications',
    'apps.governance',
    'apps.ledger',
    'apps.realtime',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'
ASGI_APPLICATION = 'config.asgi.application'
WSGI_APPLICATION = 'config.wsgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]


def _parse_database_url(url: str) -> dict:
    parsed = urlparse(url)
    return {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': parsed.path.lstrip('/') or 'adprms',
        'USER': parsed.username or 'adprms',
        'PASSWORD': parsed.password or '',
        'HOST': parsed.hostname or 'localhost',
        'PORT': str(parsed.port or 5432),
        'CONN_MAX_AGE': 60,
        'OPTIONS': {'connect_timeout': 10},
    }


DATABASE_URL = os.environ.get('DATABASE_URL', '')
if DATABASE_URL.startswith('postgres'):
    DATABASES = {'default': _parse_database_url(DATABASE_URL)}
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

REDIS_URL = os.environ.get('REDIS_URL', '').strip()

if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
        }
    }

    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                'hosts': [REDIS_URL],
            },
        },
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'adprms-local-cache',
        }
    }

    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        },
    }

CELERY_BROKER_URL = REDIS_URL or 'memory://'
CELERY_RESULT_BACKEND = REDIS_URL or 'cache+memory://'
CELERY_TASK_ALWAYS_EAGER = not bool(REDIS_URL)
CELERY_TIMEZONE = 'Africa/Addis_Ababa'
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 300

AUTH_USER_MODEL = 'accounts.UserAccount'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 12}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Addis_Ababa'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': '30/minute',
        'user': '240/minute',
        'otp_request': '3/10minute',
        'otp_verify': '5/10minute',
        'payment_init': '20/minute',
    },
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'AUTH_HEADER_TYPES': ('Bearer',),
}

CORS_ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get('CORS_ALLOWED_ORIGINS', 'http://localhost:3000').split(',') if o.strip()
]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in os.environ.get('CSRF_TRUSTED_ORIGINS', 'http://localhost:3000').split(',') if o.strip()
]

# Private Object Storage (S3 or GCS)
STORAGE_BACKEND = os.environ.get('STORAGE_BACKEND', 's3').lower()
AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME', 'adprms-private-evidence')
AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', 'eu-west-1')
AWS_S3_ENDPOINT_URL = os.environ.get('AWS_S3_ENDPOINT_URL') or None
AWS_DEFAULT_ACL = 'private'
AWS_QUERYSTRING_EXPIRE = 300
GS_BUCKET_NAME = os.environ.get('GS_BUCKET_NAME', 'adprms-private-evidence')
GS_DEFAULT_ACL = 'private'
GS_EXPIRATION = timedelta(minutes=5)

# Background Web Push (VAPID)
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_SUBJECT = os.environ.get('VAPID_SUBJECT', 'mailto:ops@adprms.example.et')

# Ethiopian Gateways & SMS
ARIFPAY_API_KEY = os.environ.get('ARIFPAY_API_KEY', '')
ARIFPAY_WEBHOOK_SECRET = os.environ.get('ARIFPAY_WEBHOOK_SECRET', '')
ARIFPAY_BASE_URL = os.environ.get('ARIFPAY_BASE_URL', 'https://gateway.arifpay.org/api')

TELEBIRR_FABRIC_APP_ID = os.environ.get('TELEBIRR_FABRIC_APP_ID', '')
TELEBIRR_APP_SECRET = os.environ.get('TELEBIRR_APP_SECRET', '')
TELEBIRR_MERCHANT_CODE = os.environ.get('TELEBIRR_MERCHANT_CODE', '')
TELEBIRR_PRIVATE_KEY_PEM = os.environ.get('TELEBIRR_PRIVATE_KEY_PEM', '')
TELEBIRR_PUBLIC_KEY_PEM = os.environ.get('TELEBIRR_PUBLIC_KEY_PEM', '')
TELEBIRR_BASE_URL = os.environ.get(
    'TELEBIRR_BASE_URL',
    'https://developerportal.ethiotelebirr.et:38443/apiaccess/payment/gateway',
)

SMS_PROVIDER = os.environ.get('SMS_PROVIDER', 'sandbox').lower()
SMS_API_KEY = os.environ.get('SMS_API_KEY', '')
SMS_SENDER_ID = os.environ.get('SMS_SENDER_ID', 'ADPRMS')

# Fiscal Tax & Live Gateway Guardrails (Disabled by default until adviser sign-off & verified production credentials)
ENABLE_LIVE_TAX_INVOICING = os.environ.get('ENABLE_LIVE_TAX_INVOICING', 'False').lower() == 'true'
ENABLE_LIVE_GATEWAYS = os.environ.get('ENABLE_LIVE_GATEWAYS', 'False').lower() == 'true'

FIELD_ENCRYPTION_KEY = os.environ.get('FIELD_ENCRYPTION_KEY', '')

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'mask_pii': {
            '()': 'apps.common.logging.PiiMaskingFilter',
        },
    },
    'formatters': {
        'json_safe': {
            'format': '%(asctime)s %(levelname)s %(name)s %(message)s',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'filters': ['mask_pii'],
            'formatter': 'json_safe',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}
