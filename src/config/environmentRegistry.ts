export type EnvGroupId =
  | 'supabase'
  | 'frontend'
  | 'express'
  | 'django'
  | 'storage'
  | 'gateways'
  | 'fiscal';

export type EnvScope = 'browser' | 'server-root' | 'server-backend';
export type EnvInputKind = 'text' | 'url' | 'ws-url' | 'secret' | 'textarea-pem' | 'select' | 'number' | 'boolean';
export type EnvValueSource = 'override' | 'build' | 'default';

export interface EnvGroupMeta {
  id: EnvGroupId;
  titleEn: string;
  titleAm: string;
  subtitleEn: string;
  subtitleAm: string;
  scopeLabelEn: string;
  scopeLabelAm: string;
  primaryScope: EnvScope;
}

export interface EnvVariableSpec {
  key: string;
  groupId: EnvGroupId;
  labelEn: string;
  labelAm: string;
  descriptionEn: string;
  descriptionAm: string;
  scope: EnvScope;
  alsoInRootEnv?: boolean;
  inputKind: EnvInputKind;
  options?: string[];
  defaultValue: string;
  placeholder: string;
  sensitive: boolean;
  requiredForLive?: boolean;
}

export const ENV_GROUPS: EnvGroupMeta[] = [
  {
    id: 'supabase',
    titleEn: 'Supabase & Authentication',
    titleAm: 'ሱፓቤስ እና ማረጋገጫ',
    subtitleEn: 'Connect live Supabase Auth and Postgres workspace sync directly in the browser.',
    subtitleAm: 'ቀጥታ የሱፓቤስ ማረጋገጫ እና የውሂብ ማመሳሰልን በብራውዘር ያገናኙ።',
    scopeLabelEn: 'Browser Override · Applied Immediately',
    scopeLabelAm: 'የብራውዘር ቅንብር · ወዲያውኑ ይተገበራል',
    primaryScope: 'browser',
  },
  {
    id: 'frontend',
    titleEn: 'Frontend Runtime, API & Push',
    titleAm: 'የፊት-ገጽ ሩጫ፣ API እና Push',
    subtitleEn: 'Control training vs. production mode, external Django API/WS URLs, and browser VAPID key.',
    subtitleAm: 'የስልጠና ወይም የምርት ሁነታን፣ የAPI/WS አድራሻዎችን እና የVAPID ቁልፍን ይቆጣጠሩ።',
    scopeLabelEn: 'Browser Override · Applied Immediately',
    scopeLabelAm: 'የብራውዘር ቅንብር · ወዲያውኑ ይተገበራል',
    primaryScope: 'browser',
  },
  {
    id: 'express',
    titleEn: 'Office Express Server & AI Proxy',
    titleAm: 'የቢሮ Express ሰርቨር እና AI ፕሮክሲ',
    subtitleEn: 'Node.js port, SQLite path, session signing, host allowlist, and Gemini server key for root .env export.',
    subtitleAm: 'የNode.js ወደብ፣ የSQLite መንገድ፣ የክፍለ-ጊዜ ሚስጥር እና የGemini ቁልፍ ለroot .env ማውጫ።',
    scopeLabelEn: 'Server Export Only · Never Stored in Browser',
    scopeLabelAm: 'ለሰርቨር .env ማውጫ ብቻ · በብራውዘር አይቀመጥም',
    primaryScope: 'server-root',
  },
  {
    id: 'django',
    titleEn: 'Django Production Core & Database',
    titleAm: 'የDjango ምርት ኮር እና ዳታቤዝ',
    subtitleEn: 'Django settings, secret & field encryption keys, CORS/CSRF origins, PostgreSQL, and Redis URLs.',
    subtitleAm: 'የDjango ቅንብሮች፣ ሚስጥራዊ ቁልፎች፣ CORS/CSRF እና የPostgreSQL/Redis አድራሻዎች።',
    scopeLabelEn: 'Backend Export Only · Never Stored in Browser',
    scopeLabelAm: 'ለBackend .env ማውጫ ብቻ · በብራውዘር አይቀመጥም',
    primaryScope: 'server-backend',
  },
  {
    id: 'storage',
    titleEn: 'Private Object Storage & Web Push',
    titleAm: 'የግል ሰነድ ማከማቻ እና Web Push',
    subtitleEn: 'S3 / GCS private evidence bucket settings and server-side VAPID keys.',
    subtitleAm: 'የS3 / GCS የማስረጃ ማከማቻ እና የሰርቨር VAPID ቁልፎች።',
    scopeLabelEn: 'Backend Export Only · Never Stored in Browser',
    scopeLabelAm: 'ለBackend .env ማውጫ ብቻ · በብራውዘር አይቀመጥም',
    primaryScope: 'server-backend',
  },
  {
    id: 'gateways',
    titleEn: 'Ethiopian Payment Gateways & SMS',
    titleAm: 'የኢትዮጵያ ክፍያ መግቢያዎች እና SMS',
    subtitleEn: 'ArifPay, Telebirr RSA/Fabric credentials, webhook verification, and Ethiopian SMS gateway settings.',
    subtitleAm: 'ArifPay፣ ቴሌብር፣ የwebhook ማረጋገጫ እና የSMS መግቢያ ቅንብሮች።',
    scopeLabelEn: 'Server & Backend Export · Never Stored in Browser',
    scopeLabelAm: 'ለሰርቨር .env ማውጫ ብቻ · በብራውዘር አይቀመጥም',
    primaryScope: 'server-backend',
  },
  {
    id: 'fiscal',
    titleEn: 'Fiscal & Statutory Guardrails',
    titleAm: 'የታክስ እና ህጋዊ ገደቦች',
    subtitleEn: 'Hard guardrail preventing live ERCA tax invoicing until licensed adviser and owner sign-off.',
    subtitleAm: 'የባለሙያ እና የባለቤት ማረጋገጫ ሳይኖር ቀጥታ የERCA ደረሰኝ መቁረጥን የሚከለክል ገደብ።',
    scopeLabelEn: 'Backend Export Only · Default False',
    scopeLabelAm: 'ለBackend .env ማውጫ ብቻ · ነባሪ ዋጋ False',
    primaryScope: 'server-backend',
  },
];

export const ENV_VARIABLE_REGISTRY: EnvVariableSpec[] = [
  // 1. Supabase & Auth
  {
    key: 'VITE_SUPABASE_URL',
    groupId: 'supabase',
    labelEn: 'Supabase Project URL',
    labelAm: 'የሱፓቤስ ፕሮጀክት ዩ አር ኤል',
    descriptionEn:
      'Supabase training project URL (default: https://vzjojdnttsfdwynumxtv.supabase.co). Found in Project Settings -> Data API / General.',
    descriptionAm: 'የሱፓቤስ የስልጠና ፕሮጀክት URL (ነባሪ: https://vzjojdnttsfdwynumxtv.supabase.co)።',
    scope: 'browser',
    inputKind: 'url',
    defaultValue: 'https://vzjojdnttsfdwynumxtv.supabase.co',
    placeholder: 'https://vzjojdnttsfdwynumxtv.supabase.co',
    sensitive: false,
  },
  {
    key: 'VITE_SUPABASE_ANON_KEY',
    groupId: 'supabase',
    labelEn: 'Supabase Publishable Key (Public)',
    labelAm: 'የሱፓቤስ Public Publishable ቁልፍ',
    descriptionEn:
      'Public browser publishable key (sb_publishable_... or legacy anon JWT) protected by Row Level Security. Never enter sb_secret_... or database passwords.',
    descriptionAm:
      'ከRow Level Security ጋር የሚሰራ የህዝብ sb_publishable_... ቁልፍ። sb_secret_... ወይም የዳታቤዝ የይለፍ ቃል አያስገቡ።',
    scope: 'browser',
    inputKind: 'text',
    defaultValue: '',
    placeholder: 'sb_publishable_...',
    sensitive: false,
  },

  // 2. Frontend Runtime, API & Push
  {
    key: 'VITE_APP_MODE',
    groupId: 'frontend',
    labelEn: 'Application Runtime Mode',
    labelAm: 'የመተግበሪያ አሰራር ሁነታ',
    descriptionEn: 'Selects training simulation (synthetic accounts) or live production login posture.',
    descriptionAm: 'የስልጠና ማስመሰያ ወይም የምርት መግቢያ ሁነታን ይመርጣል።',
    scope: 'browser',
    inputKind: 'select',
    options: ['training', 'production'],
    defaultValue: 'training',
    placeholder: 'training',
    sensitive: false,
  },
  {
    key: 'VITE_API_BASE_URL',
    groupId: 'frontend',
    labelEn: 'External Django API Base URL',
    labelAm: 'የውጭ Django API መነሻ አድራሻ',
    descriptionEn: 'Leave blank for built-in Office SQLite mode, or set HTTPS origin for Django DRF API.',
    descriptionAm: 'ለአካባቢያዊ SQLite ባዶ ይተዉት፤ ለDjango DRF API የHTTPS አድራሻ ያስገቡ።',
    scope: 'browser',
    inputKind: 'url',
    defaultValue: '',
    placeholder: 'https://api.prms.example.et',
    sensitive: false,
  },
  {
    key: 'VITE_WS_BASE_URL',
    groupId: 'frontend',
    labelEn: 'External WebSocket Sync URL',
    labelAm: 'የውጭ WebSocket ማመሳሰያ አድራሻ',
    descriptionEn: 'Optional wss:// endpoint for Django Channels real-time sync.',
    descriptionAm: 'ለDjango Channels ቀጥታ ማመሳሰል አማራጭ wss:// አድራሻ።',
    scope: 'browser',
    inputKind: 'ws-url',
    defaultValue: '',
    placeholder: 'wss://api.prms.example.et',
    sensitive: false,
  },
  {
    key: 'VITE_VAPID_PUBLIC_KEY',
    groupId: 'frontend',
    labelEn: 'Browser Web Push VAPID Public Key',
    labelAm: 'የብራውዘር Web Push VAPID ቁልፍ',
    descriptionEn: 'URL-safe base64 VAPID public key used when subscribing PWA devices.',
    descriptionAm: 'ለPWA መሳሪያዎች ማሳወቂያ መመዝገቢያ የVAPID የህዝብ ቁልፍ።',
    scope: 'browser',
    inputKind: 'text',
    defaultValue: '',
    placeholder: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9...',
    sensitive: false,
  },

  // 3. Office Express Server & AI Proxy
  {
    key: 'APP_URL',
    groupId: 'express',
    labelEn: 'Public Application URL',
    labelAm: 'የመተግበሪያው ይፋዊ ዩ አር ኤል',
    descriptionEn: 'Allowed origin for cookie-authenticated Express mutations.',
    descriptionAm: 'ለExpress ክፍለ-ጊዜ ጥያቄዎች የተፈቀደ የመነሻ አድራሻ።',
    scope: 'server-root',
    inputKind: 'url',
    defaultValue: '',
    placeholder: 'https://prms.example.et',
    sensitive: false,
  },
  {
    key: 'PORT',
    groupId: 'express',
    labelEn: 'Express Server Port',
    labelAm: 'የExpress ሰርቨር ወደብ',
    descriptionEn: 'HTTP listening port for the Node server (AI Studio requires 3000).',
    descriptionAm: 'የNode ሰርቨር የሚያዳምጥበት ወደብ (ነባሪ 3000)።',
    scope: 'server-root',
    inputKind: 'number',
    defaultValue: '3000',
    placeholder: '3000',
    sensitive: false,
  },
  {
    key: 'HOST',
    groupId: 'express',
    labelEn: 'Express Bind Host',
    labelAm: 'የExpress Bind Host',
    descriptionEn: 'Network interface address for the Express HTTP server.',
    descriptionAm: 'የExpress ሰርቨር የሚታሰርበት የአውታረ መረብ አድራሻ።',
    scope: 'server-root',
    inputKind: 'text',
    defaultValue: '0.0.0.0',
    placeholder: '0.0.0.0',
    sensitive: false,
  },
  {
    key: 'OFFICE_DB_PATH',
    groupId: 'express',
    labelEn: 'Office SQLite Database Path',
    labelAm: 'የOffice SQLite ዳታቤዝ መንገድ',
    descriptionEn: 'Optional custom filesystem path for the Office Training SQLite database.',
    descriptionAm: 'ለOffice Training SQLite ዳታቤዝ አማራጭ የፋይል መንገድ።',
    scope: 'server-root',
    inputKind: 'text',
    defaultValue: '',
    placeholder: '/var/data/adprms-office.sqlite',
    sensitive: false,
  },
  {
    key: 'OFFICE_SESSION_SECRET',
    groupId: 'express',
    labelEn: 'Office Session Signing Secret',
    labelAm: 'የOffice ክፍለ-ጊዜ ፊርማ ሚስጥር',
    descriptionEn: 'HMAC secret signing HTTP-only office session cookies (server-side only).',
    descriptionAm: 'የOffice ክፍለ-ጊዜ ኩኪዎችን የሚፈርም ሚስጥራዊ ቁልፍ (በሰርቨር ብቻ)።',
    scope: 'server-root',
    inputKind: 'secret',
    defaultValue: '',
    placeholder: 'CHANGE_ME_LONG_RANDOM_HMAC_SECRET',
    sensitive: true,
    requiredForLive: true,
  },
  {
    key: 'ALLOWED_VITE_HOSTS',
    groupId: 'express',
    labelEn: 'Allowed Vite Preview Hosts',
    labelAm: 'የተፈቀዱ የVite አስተናጋጅ ስሞች',
    descriptionEn: 'Comma-separated hostnames permitted by Vite dev middleware.',
    descriptionAm: 'በVite dev middleware የተፈቀዱ የአስተናጋጅ ስሞች (በኮማ የተለዩ)።',
    scope: 'server-root',
    inputKind: 'text',
    defaultValue: '',
    placeholder: 'localhost,prms.example.et',
    sensitive: false,
  },
  {
    key: 'GEMINI_API_KEY',
    groupId: 'express',
    labelEn: 'Gemini API Key (Server Proxy)',
    labelAm: 'የGemini API ቁልፍ (ለሰርቨር ብቻ)',
    descriptionEn: 'Server-side Gemini API credential; never exposed to client code.',
    descriptionAm: 'በሰርቨር በኩል ብቻ የሚያገለግል የGemini API ቁልፍ።',
    scope: 'server-root',
    inputKind: 'secret',
    defaultValue: '',
    placeholder: 'MY_GEMINI_API_KEY',
    sensitive: true,
  },

  // 4. Django Core & Database
  {
    key: 'DJANGO_ENV',
    groupId: 'django',
    labelEn: 'Django Environment',
    labelAm: 'የDjango አካባቢ (Environment)',
    descriptionEn: 'Controls development vs. hardened production behavior in Django settings.',
    descriptionAm: 'በDjango ውስጥ የልማት ወይም የምርት ሁኔታን ይቆጣጠራል።',
    scope: 'server-backend',
    alsoInRootEnv: true,
    inputKind: 'select',
    options: ['dev', 'test', 'prod'],
    defaultValue: 'dev',
    placeholder: 'prod',
    sensitive: false,
  },
  {
    key: 'DJANGO_SETTINGS_MODULE',
    groupId: 'django',
    labelEn: 'Django Settings Module',
    labelAm: 'የDjango ቅንብር ሞጁል',
    descriptionEn: 'Python dotted path to active Django settings module.',
    descriptionAm: 'ወደ ንቁ የDjango ቅንብር ፋይል የሚያመለክት መንገድ።',
    scope: 'server-backend',
    inputKind: 'select',
    options: ['config.settings.dev', 'config.settings.prod'],
    defaultValue: 'config.settings.prod',
    placeholder: 'config.settings.prod',
    sensitive: false,
  },
  {
    key: 'DJANGO_SECRET_KEY',
    groupId: 'django',
    labelEn: 'Django Secret Key',
    labelAm: 'የDjango ሚስጥራዊ ቁልፍ',
    descriptionEn: 'Cryptographic signing key required by Django in production.',
    descriptionAm: 'ለDjango ምርት ስራ የሚያስፈልግ ሚስጥራዊ ቁልፍ።',
    scope: 'server-backend',
    alsoInRootEnv: true,
    inputKind: 'secret',
    defaultValue: '',
    placeholder: 'CHANGE_ME_LONG_RANDOM_SECRET',
    sensitive: true,
    requiredForLive: true,
  },
  {
    key: 'DJANGO_DEBUG',
    groupId: 'django',
    labelEn: 'Django Debug Mode',
    labelAm: 'የDjango Debug ሁነታ',
    descriptionEn: 'Must remain False in production deployments.',
    descriptionAm: 'በምርት ሰርቨር ላይ ሁልጊዜ False መሆን አለበት።',
    scope: 'server-backend',
    alsoInRootEnv: true,
    inputKind: 'boolean',
    options: ['False', 'True'],
    defaultValue: 'False',
    placeholder: 'False',
    sensitive: false,
  },
  {
    key: 'DJANGO_ALLOWED_HOSTS',
    groupId: 'django',
    labelEn: 'Django Allowed Hosts',
    labelAm: 'የተፈቀዱ የDjango አስተናጋጆች',
    descriptionEn: 'Comma-separated hostnames accepted by Django.',
    descriptionAm: 'በDjango የሚፈቀዱ ጎራዎች (በኮማ የተለዩ)።',
    scope: 'server-backend',
    alsoInRootEnv: true,
    inputKind: 'text',
    defaultValue: 'localhost,127.0.0.1',
    placeholder: 'prms.example.et,api.prms.example.et',
    sensitive: false,
  },
  {
    key: 'CORS_ALLOWED_ORIGINS',
    groupId: 'django',
    labelEn: 'CORS Allowed Origins',
    labelAm: 'የCORS የተፈቀዱ መነሻዎች',
    descriptionEn: 'Comma-separated frontend origins allowed to query Django API.',
    descriptionAm: 'ወደ Django API ጥያቄ መላክ የሚችሉ የፊት-ገጽ አድራሻዎች።',
    scope: 'server-backend',
    inputKind: 'text',
    defaultValue: 'http://localhost:3000',
    placeholder: 'https://prms.example.et',
    sensitive: false,
  },
  {
    key: 'CSRF_TRUSTED_ORIGINS',
    groupId: 'django',
    labelEn: 'CSRF Trusted Origins',
    labelAm: 'የCSRF የታመኑ መነሻዎች',
    descriptionEn: 'Comma-separated HTTPS origins trusted for CSRF validation.',
    descriptionAm: 'ለCSRF ማረጋገጫ የታመኑ የHTTPS አድራሻዎች።',
    scope: 'server-backend',
    inputKind: 'text',
    defaultValue: 'http://localhost:3000',
    placeholder: 'https://prms.example.et',
    sensitive: false,
  },
  {
    key: 'SECURE_SSL_REDIRECT',
    groupId: 'django',
    labelEn: 'Force HTTPS SSL Redirect',
    labelAm: 'HTTPS SSL ማስገደጃ',
    descriptionEn: 'Redirects plain HTTP traffic to HTTPS in Django production settings.',
    descriptionAm: 'በDjango ምርት ሁነታ HTTPን ወደ HTTPS ያዞራል።',
    scope: 'server-backend',
    inputKind: 'boolean',
    options: ['True', 'False'],
    defaultValue: 'True',
    placeholder: 'True',
    sensitive: false,
  },
  {
    key: 'FIELD_ENCRYPTION_KEY',
    groupId: 'django',
    labelEn: 'Fernet Field Encryption Key',
    labelAm: 'የመስክ ምስጠራ ቁልፍ (Fernet)',
    descriptionEn: '32-byte URL-safe base64 Fernet key encrypting sensitive PII & gateway secrets.',
    descriptionAm: 'ሚስጥራዊ መረጃዎችን ለመመስጠር የሚያገለግል ባለ 32-ባይት Fernet ቁልፍ።',
    scope: 'server-backend',
    alsoInRootEnv: true,
    inputKind: 'secret',
    defaultValue: '',
    placeholder: 'CHANGE_ME_FERNET_32_BYTE_BASE64_KEY',
    sensitive: true,
    requiredForLive: true,
  },
  {
    key: 'DATABASE_URL',
    groupId: 'django',
    labelEn: 'PostgreSQL Connection DSN',
    labelAm: 'የPostgreSQL የግንኙነት DSN',
    descriptionEn: 'PostgreSQL 16 connection URI enforcing owner RLS policies.',
    descriptionAm: 'የPostgreSQL 16 ዳታቤዝ የግንኙነት አድራሻ።',
    scope: 'server-backend',
    alsoInRootEnv: true,
    inputKind: 'secret',
    defaultValue: '',
    placeholder: 'postgres://adprms:CHANGE_ME_DB_PASSWORD@postgres:5432/adprms',
    sensitive: true,
    requiredForLive: true,
  },
  {
    key: 'REDIS_URL',
    groupId: 'django',
    labelEn: 'Redis Cache & Channels URL',
    labelAm: 'የRedis ካሽ እና Channels አድራሻ',
    descriptionEn: 'Redis 7 URI for Celery workers and Django Channels WebSocket pub/sub.',
    descriptionAm: 'ለCelery እና WebSocket የሚያገለግል የRedis አድራሻ።',
    scope: 'server-backend',
    alsoInRootEnv: true,
    inputKind: 'secret',
    defaultValue: '',
    placeholder: 'redis://redis:6379/0',
    sensitive: true,
  },

  // 5. Private Object Storage & Web Push
  {
    key: 'STORAGE_BACKEND',
    groupId: 'storage',
    labelEn: 'Object Storage Backend',
    labelAm: 'የፋይል ማከማቻ አይነት',
    descriptionEn: 'Private object store driver for leases, CBE slips, and ERCA evidence.',
    descriptionAm: 'ለውሎች እና ለክፍያ ማስረጃዎች የሚያገለግል የማከማቻ ዘዴ።',
    scope: 'server-backend',
    inputKind: 'select',
    options: ['s3', 'gcs'],
    defaultValue: 's3',
    placeholder: 's3',
    sensitive: false,
  },
  {
    key: 'AWS_STORAGE_BUCKET_NAME',
    groupId: 'storage',
    labelEn: 'AWS S3 Private Bucket Name',
    labelAm: 'የAWS S3 Bucket ስም',
    descriptionEn: 'Private S3 bucket name when STORAGE_BACKEND=s3.',
    descriptionAm: 'STORAGE_BACKEND=s3 ሲሆን የሚያገለግል የግል bucket ስም።',
    scope: 'server-backend',
    inputKind: 'text',
    defaultValue: 'adprms-private-evidence',
    placeholder: 'adprms-private-evidence',
    sensitive: false,
  },
  {
    key: 'AWS_S3_REGION_NAME',
    groupId: 'storage',
    labelEn: 'AWS S3 Region',
    labelAm: 'የAWS S3 ክልል (Region)',
    descriptionEn: 'Cloud region hosting the private evidence bucket.',
    descriptionAm: 'የS3 bucket የሚገኝበት ክልል።',
    scope: 'server-backend',
    inputKind: 'text',
    defaultValue: 'eu-west-1',
    placeholder: 'eu-west-1',
    sensitive: false,
  },
  {
    key: 'AWS_S3_ENDPOINT_URL',
    groupId: 'storage',
    labelEn: 'Custom S3-Compatible Endpoint',
    labelAm: 'አማራጭ S3-Compatible አድራሻ',
    descriptionEn: 'Optional custom MinIO or S3-compatible endpoint URL.',
    descriptionAm: 'ለMinIO ወይም ተመሳሳይ S3 አገልግሎት አማራጭ አድራሻ።',
    scope: 'server-backend',
    inputKind: 'url',
    defaultValue: '',
    placeholder: 'https://s3.internal.example.et',
    sensitive: false,
  },
  {
    key: 'GS_BUCKET_NAME',
    groupId: 'storage',
    labelEn: 'Google Cloud Storage Bucket',
    labelAm: 'የGoogle Cloud Storage Bucket',
    descriptionEn: 'Private GCS bucket name when STORAGE_BACKEND=gcs.',
    descriptionAm: 'STORAGE_BACKEND=gcs ሲሆን የሚያገለግል የGCS bucket ስም።',
    scope: 'server-backend',
    inputKind: 'text',
    defaultValue: 'adprms-private-evidence',
    placeholder: 'adprms-private-evidence',
    sensitive: false,
  },
  {
    key: 'VAPID_PUBLIC_KEY',
    groupId: 'storage',
    labelEn: 'Server VAPID Public Key',
    labelAm: 'የሰርቨር VAPID የህዝብ ቁልፍ',
    descriptionEn: 'Matches VITE_VAPID_PUBLIC_KEY on the Django/Celery push dispatcher.',
    descriptionAm: 'ከVITE_VAPID_PUBLIC_KEY ጋር የሚመሳሰል የሰርቨር የህዝብ ቁልፍ።',
    scope: 'server-backend',
    inputKind: 'text',
    defaultValue: '',
    placeholder: 'CHANGE_ME_VAPID_PUBLIC_KEY',
    sensitive: false,
  },
  {
    key: 'VAPID_PRIVATE_KEY',
    groupId: 'storage',
    labelEn: 'Server VAPID Private Key',
    labelAm: 'የሰርቨር VAPID የግል ቁልፍ',
    descriptionEn: 'Private signing key used by backend workers to send Web Push notifications.',
    descriptionAm: 'የWeb Push ማሳወቂያዎችን ለመላክ በሰርቨር የሚያገለግል የግል ቁልፍ።',
    scope: 'server-backend',
    inputKind: 'secret',
    defaultValue: '',
    placeholder: 'CHANGE_ME_VAPID_PRIVATE_KEY',
    sensitive: true,
  },
  {
    key: 'VAPID_SUBJECT',
    groupId: 'storage',
    labelEn: 'VAPID Contact Subject',
    labelAm: 'የVAPID መገኛ አድራሻ',
    descriptionEn: 'mailto: or https: contact URI required by Web Push services.',
    descriptionAm: 'በWeb Push አገልግሎት የሚፈለግ mailto: ወይም https: አድራሻ።',
    scope: 'server-backend',
    inputKind: 'text',
    defaultValue: 'mailto:ops@adprms.example.et',
    placeholder: 'mailto:ops@adprms.example.et',
    sensitive: false,
  },

  // 6. Ethiopian Payment Gateways & SMS
  {
    key: 'ENABLE_LIVE_GATEWAYS',
    groupId: 'gateways',
    labelEn: 'Enable Live Payment Gateways',
    labelAm: 'ቀጥታ የክፍያ መግቢያዎችን አንቃ',
    descriptionEn: 'Must remain False in training/sandbox environments.',
    descriptionAm: 'በስልጠና እና በሙከራ አካባቢ False መሆን አለበት።',
    scope: 'server-backend',
    inputKind: 'boolean',
    options: ['False', 'True'],
    defaultValue: 'False',
    placeholder: 'False',
    sensitive: false,
  },
  {
    key: 'ARIFPAY_API_KEY',
    groupId: 'gateways',
    labelEn: 'ArifPay API Key',
    labelAm: 'የArifPay API ቁልፍ',
    descriptionEn: 'Merchant API key issued by ArifPay for checkout session creation.',
    descriptionAm: 'ለክፍያ ክፍለ-ጊዜ መፍጠሪያ በArifPay የሚሰጥ ሚስጥራዊ ቁልፍ።',
    scope: 'server-backend',
    inputKind: 'secret',
    defaultValue: '',
    placeholder: 'CHANGE_ME_ARIFPAY_KEY',
    sensitive: true,
  },
  {
    key: 'ARIFPAY_WEBHOOK_SECRET',
    groupId: 'gateways',
    labelEn: 'ArifPay Webhook HMAC Secret',
    labelAm: 'የArifPay Webhook HMAC ሚስጥር',
    descriptionEn: 'Verifies x-arifpay-signature headers on Express and Django webhook endpoints.',
    descriptionAm: 'በExpress እና Django ላይ የArifPay webhook ፊርማን ያረጋግጣል።',
    scope: 'server-backend',
    alsoInRootEnv: true,
    inputKind: 'secret',
    defaultValue: '',
    placeholder: 'CHANGE_ME_ARIFPAY_WEBHOOK_SECRET',
    sensitive: true,
  },
  {
    key: 'ARIFPAY_BASE_URL',
    groupId: 'gateways',
    labelEn: 'ArifPay API Base URL',
    labelAm: 'የArifPay API አድራሻ',
    descriptionEn: 'ArifPay gateway API endpoint URL.',
    descriptionAm: 'የArifPay ክፍያ መግቢያ መነሻ አድራሻ።',
    scope: 'server-backend',
    inputKind: 'url',
    defaultValue: 'https://gateway.arifpay.org/api',
    placeholder: 'https://gateway.arifpay.org/api',
    sensitive: false,
  },
  {
    key: 'TELEBIRR_FABRIC_APP_ID',
    groupId: 'gateways',
    labelEn: 'Telebirr Fabric App ID',
    labelAm: 'የቴሌብር Fabric App ID',
    descriptionEn: 'Ethio Telecom Telebirr Fabric application identifier.',
    descriptionAm: 'የኢትዮ ቴሌኮም ቴሌብር Fabric መተግበሪያ መለያ።',
    scope: 'server-backend',
    inputKind: 'text',
    defaultValue: '',
    placeholder: 'CHANGE_ME_TELEBIRR_APP_ID',
    sensitive: false,
  },
  {
    key: 'TELEBIRR_APP_SECRET',
    groupId: 'gateways',
    labelEn: 'Telebirr App Secret',
    labelAm: 'የቴሌብር App ሚስጥር',
    descriptionEn: 'Confidential Telebirr Fabric app secret.',
    descriptionAm: 'ሚስጥራዊ የቴሌብር Fabric ቁልፍ።',
    scope: 'server-backend',
    inputKind: 'secret',
    defaultValue: '',
    placeholder: 'CHANGE_ME_TELEBIRR_APP_SECRET',
    sensitive: true,
  },
  {
    key: 'TELEBIRR_MERCHANT_CODE',
    groupId: 'gateways',
    labelEn: 'Telebirr Merchant Shortcode',
    labelAm: 'የቴሌብር ነጋዴ ኮድ',
    descriptionEn: 'Assigned merchant code / USSD till identifier.',
    descriptionAm: 'ለድርጅቱ የተሰጠ የቴሌብር ነጋዴ መለያ ኮድ።',
    scope: 'server-backend',
    inputKind: 'text',
    defaultValue: '',
    placeholder: 'CHANGE_ME_MERCHANT_CODE',
    sensitive: false,
  },
  {
    key: 'TELEBIRR_PRIVATE_KEY_PEM',
    groupId: 'gateways',
    labelEn: 'Telebirr Merchant RSA Private Key (PEM)',
    labelAm: 'የቴሌብር የግል RSA ቁልፍ (PEM)',
    descriptionEn: 'RSA private key signing outbound Telebirr USSD/QR requests.',
    descriptionAm: 'ወደ ቴሌብር የሚላኩ ጥያቄዎችን የሚፈርም የግል RSA ቁልፍ።',
    scope: 'server-backend',
    inputKind: 'textarea-pem',
    defaultValue: '',
    placeholder: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----',
    sensitive: true,
  },
  {
    key: 'TELEBIRR_PUBLIC_KEY_PEM',
    groupId: 'gateways',
    labelEn: 'Telebirr Gateway RSA Public Key (PEM)',
    labelAm: 'የቴሌብር የህዝብ RSA ቁልፍ (PEM)',
    descriptionEn: 'RSA public key verifying Telebirr webhook signatures on Express and Django.',
    descriptionAm: 'የቴሌብር webhook ፊርማን የሚያረጋግጥ የህዝብ RSA ቁልፍ።',
    scope: 'server-backend',
    alsoInRootEnv: true,
    inputKind: 'textarea-pem',
    defaultValue: '',
    placeholder: '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----',
    sensitive: false,
  },
  {
    key: 'TELEBIRR_BASE_URL',
    groupId: 'gateways',
    labelEn: 'Telebirr Gateway Base URL',
    labelAm: 'የቴሌብር መግቢያ አድራሻ',
    descriptionEn: 'Ethio Telecom Telebirr developer/production gateway endpoint.',
    descriptionAm: 'የኢትዮ ቴሌኮም ቴሌብር ክፍያ መግቢያ አድራሻ።',
    scope: 'server-backend',
    inputKind: 'url',
    defaultValue: 'https://developerportal.ethiotelebirr.et:38443/apiaccess/payment/gateway',
    placeholder: 'https://developerportal.ethiotelebirr.et:38443/apiaccess/payment/gateway',
    sensitive: false,
  },
  {
    key: 'SMS_PROVIDER',
    groupId: 'gateways',
    labelEn: 'Ethiopian SMS Gateway Provider',
    labelAm: 'የSMS አገልግሎት አቅራቢ',
    descriptionEn: 'Selects sandbox logging or live Ethiopian SMS provider integration.',
    descriptionAm: 'የሙከራ መዝገብ ወይም ቀጥታ የኢትዮጵያ SMS አቅራቢን ይመርጣል።',
    scope: 'server-backend',
    inputKind: 'select',
    options: ['sandbox', 'afromessage', 'geezsms', 'ethiotelecom'],
    defaultValue: 'sandbox',
    placeholder: 'sandbox',
    sensitive: false,
  },
  {
    key: 'SMS_API_KEY',
    groupId: 'gateways',
    labelEn: 'SMS Provider API Key',
    labelAm: 'የSMS API ቁልፍ',
    descriptionEn: 'API token for the selected live Ethiopian SMS gateway.',
    descriptionAm: 'ለተመረጠው የSMS አቅራቢ የሚያገለግል የAPI ቁልፍ።',
    scope: 'server-backend',
    inputKind: 'secret',
    defaultValue: '',
    placeholder: 'CHANGE_ME_SMS_API_KEY',
    sensitive: true,
  },
  {
    key: 'SMS_SENDER_ID',
    groupId: 'gateways',
    labelEn: 'SMS Sender ID',
    labelAm: 'የSMS ላኪ መለያ (Sender ID)',
    descriptionEn: 'Alphanumeric sender ID shown on tenant rent reminder SMS messages.',
    descriptionAm: 'ለተከራዮች በሚላክ የSMS ማሳሰቢያ ላይ የሚታይ የላኪ ስም።',
    scope: 'server-backend',
    inputKind: 'text',
    defaultValue: 'ADPRMS',
    placeholder: 'ADPRMS',
    sensitive: false,
  },

  // 7. Fiscal & Statutory Guardrails
  {
    key: 'ENABLE_LIVE_TAX_INVOICING',
    groupId: 'fiscal',
    labelEn: 'Enable Live ERCA Tax Invoicing',
    labelAm: 'ቀጥታ የERCA ታክስ ደረሰኝ አንቃ',
    descriptionEn: 'MUST remain False until ERCA registration and licensed tax adviser sign-off are verified.',
    descriptionAm: 'የERCA ምዝገባ እና የታክስ አማካሪ ማረጋገጫ እስኪጠናቀቅ ድረስ False መሆን አለበት።',
    scope: 'server-backend',
    inputKind: 'boolean',
    options: ['False', 'True'],
    defaultValue: 'False',
    placeholder: 'False',
    sensitive: false,
  },
];

export const BROWSER_ENV_STORAGE_KEYS: Record<string, string> = {
  VITE_SUPABASE_URL: 'PRMS_SUPABASE_URL',
  VITE_SUPABASE_ANON_KEY: 'PRMS_SUPABASE_ANON_KEY',
  VITE_APP_MODE: 'PRMS_ENV_VITE_APP_MODE',
  VITE_API_BASE_URL: 'PRMS_ENV_VITE_API_BASE_URL',
  VITE_WS_BASE_URL: 'PRMS_ENV_VITE_WS_BASE_URL',
  VITE_VAPID_PUBLIC_KEY: 'PRMS_ENV_VITE_VAPID_PUBLIC_KEY',
};

export const ENV_UPDATED_EVENT = 'adprms:env-updated';

const PLACEHOLDER_FRAGMENTS = ['MY_SUPABASE', 'YOUR_PROJECT_REF', 'YOUR_SUPABASE', 'CHANGE_ME'];

export function isPlaceholderEnvValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return PLACEHOLDER_FRAGMENTS.some((fragment) => trimmed.includes(fragment));
}

function readBuildTimeEnv(key: string): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, unknown> })?.env;
    const raw = env?.[key];
    return typeof raw === 'string' ? raw.trim() : '';
  } catch {
    return '';
  }
}

export function getBrowserEnvOverride(key: string): string {
  const storageKey = BROWSER_ENV_STORAGE_KEYS[key];
  if (!storageKey) return '';
  try {
    if (typeof localStorage === 'undefined') return '';
    return String(localStorage.getItem(storageKey) || '').trim();
  } catch {
    return '';
  }
}

export function getBrowserEnvSource(key: string): EnvValueSource {
  const overrideVal = getBrowserEnvOverride(key);
  if (overrideVal) return 'override';
  const buildVal = readBuildTimeEnv(key);
  if (buildVal && !isPlaceholderEnvValue(buildVal)) return 'build';
  return 'default';
}

export function getEffectiveBrowserEnvValue(key: string): string {
  const overrideVal = getBrowserEnvOverride(key);
  if (overrideVal) return overrideVal;
  const buildVal = readBuildTimeEnv(key);
  if (buildVal && !isPlaceholderEnvValue(buildVal)) return buildVal;
  const spec = ENV_VARIABLE_REGISTRY.find((v) => v.key === key);
  return spec?.defaultValue || '';
}

export function getAllEffectiveBrowserEnvValues(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const spec of ENV_VARIABLE_REGISTRY) {
    if (spec.scope === 'browser') {
      result[spec.key] = getEffectiveBrowserEnvValue(spec.key);
    }
  }
  return result;
}

export function getInitialServerDraftValues(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const spec of ENV_VARIABLE_REGISTRY) {
    if (spec.scope !== 'browser') {
      result[spec.key] = spec.defaultValue;
    }
  }
  return result;
}

function decodeJwtRoleClaim(token: string): string {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return '';
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const decoded =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded) as { role?: unknown };
    return typeof parsed.role === 'string' ? parsed.role.trim().toLowerCase() : '';
  } catch {
    return '';
  }
}

export function getProhibitedBrowserSecretReason(key: string, rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) return null;
  if (/^sb_secret_/i.test(value)) {
    return `${key}: sb_secret_... is a private server key and is prohibited in browser variables or localStorage. Use an sb_publishable_... key.`;
  }
  if (/^postgres(?:ql)?:\/\//i.test(value)) {
    return `${key}: database connection strings and passwords are prohibited in browser variables or localStorage.`;
  }
  if (key === 'VITE_SUPABASE_ANON_KEY' && decodeJwtRoleClaim(value) === 'service_role') {
    return `${key}: service_role keys are private server secrets and are prohibited in browser variables or localStorage.`;
  }
  return null;
}

export function validateEnvVariableValue(spec: EnvVariableSpec, rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) {
    return null;
  }
  if (/javascript:|data:|vbscript:/i.test(value)) {
    return `${spec.key}: unsafe URI scheme is prohibited.`;
  }
  if (spec.scope === 'browser') {
    const prohibitedReason = getProhibitedBrowserSecretReason(spec.key, value);
    if (prohibitedReason) {
      return prohibitedReason;
    }
  }

  switch (spec.inputKind) {
    case 'url': {
      try {
        const parsed = new URL(value);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          return `${spec.key}: must use https:// or http:// protocol.`;
        }
      } catch {
        return `${spec.key}: enter a valid URL (for example ${spec.placeholder}).`;
      }
      return null;
    }
    case 'ws-url': {
      try {
        const parsed = new URL(value);
        if (parsed.protocol !== 'wss:' && parsed.protocol !== 'ws:') {
          return `${spec.key}: must use wss:// or ws:// protocol.`;
        }
      } catch {
        return `${spec.key}: enter a valid WebSocket URL (for example ${spec.placeholder}).`;
      }
      return null;
    }
    case 'number': {
      const port = Number(value);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return `${spec.key}: must be a valid TCP port between 1 and 65535.`;
      }
      return null;
    }
    case 'select': {
      if (spec.options && !spec.options.includes(value)) {
        return `${spec.key}: must be one of ${spec.options.join(', ')}.`;
      }
      return null;
    }
    case 'boolean': {
      if (!['True', 'False', 'true', 'false'].includes(value)) {
        return `${spec.key}: must be True or False.`;
      }
      return null;
    }
    default: {
      if (spec.key === 'VAPID_SUBJECT' && !/^(mailto:|https?:\/\/)/i.test(value)) {
        return 'VAPID_SUBJECT: must begin with mailto: or https://.';
      }
      return null;
    }
  }
}

export function setBrowserEnvOverrides(values: Record<string, string>): void {
  if (typeof localStorage !== 'undefined') {
    for (const [key, storageKey] of Object.entries(BROWSER_ENV_STORAGE_KEYS)) {
      if (!Object.prototype.hasOwnProperty.call(values, key)) continue;
      const trimmed = String(values[key] ?? '').trim();
      if (trimmed && getProhibitedBrowserSecretReason(key, trimmed)) {
        continue;
      }
      try {
        if (trimmed) {
          localStorage.setItem(storageKey, trimmed);
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch {
        // Ignore storage errors in restricted environments
      }
    }
  }
  dispatchEnvUpdatedEvent();
}

export function clearBrowserEnvOverrides(): void {
  if (typeof localStorage !== 'undefined') {
    for (const storageKey of Object.values(BROWSER_ENV_STORAGE_KEYS)) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Ignore storage errors
      }
    }
  }
  dispatchEnvUpdatedEvent();
}

export function dispatchEnvUpdatedEvent(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(ENV_UPDATED_EVENT));
  }
}

export function maskSecretValue(rawValue: string): string {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed) return '(empty)';
  if (trimmed.length <= 8) return '***REDACTED***';
  return `***REDACTED***${trimmed.slice(-4)}`;
}

export function formatAuditEnvValue(spec: EnvVariableSpec, rawValue: string): string {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed) return '(unset)';
  if (spec.sensitive) return maskSecretValue(trimmed);
  return trimmed;
}

function escapeDotEnvValue(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n');
}

export function buildDotEnvFileContent(
  target: 'root' | 'backend',
  values: Record<string, string>
): string {
  const specs = ENV_VARIABLE_REGISTRY.filter((spec) =>
    target === 'root'
      ? spec.scope === 'browser' || spec.scope === 'server-root' || spec.alsoInRootEnv
      : spec.scope === 'server-backend'
  );

  const lines: string[] = [
    '# ------------------------------------------------------------------------------',
    target === 'root'
      ? '# AD-PRMS Root Runtime & Office Express Environment Configuration (.env)'
      : '# AD-PRMS Django 5.x + PostgreSQL Production Backend Environment (backend/.env)',
    '# Generated from AD-PRMS System Administrator Environment Groups Console.',
    '# Keep private secrets out of source control and verify before deployment.',
    '# ------------------------------------------------------------------------------',
    '',
  ];

  let currentGroup: EnvGroupId | null = null;
  for (const spec of specs) {
    if (spec.groupId !== currentGroup) {
      currentGroup = spec.groupId;
      const group = ENV_GROUPS.find((g) => g.id === currentGroup);
      if (group) {
        lines.push(`# === ${group.titleEn} ===`);
      }
    }
    const val = (values[spec.key] ?? spec.defaultValue ?? '').trim();
    lines.push(`${spec.key}="${escapeDotEnvValue(val)}"`);
  }

  lines.push('');
  return lines.join('\n');
}

export function buildGroupEnvSnippet(
  groupId: EnvGroupId,
  values: Record<string, string>
): string {
  const group = ENV_GROUPS.find((g) => g.id === groupId);
  const specs = ENV_VARIABLE_REGISTRY.filter((s) => s.groupId === groupId);
  const lines: string[] = [];
  if (group) {
    lines.push(`# ${group.titleEn}`);
  }
  for (const spec of specs) {
    const val = (values[spec.key] ?? spec.defaultValue ?? '').trim();
    lines.push(`${spec.key}="${escapeDotEnvValue(val)}"`);
  }
  return lines.join('\n');
}
