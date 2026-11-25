import DOMPurify from 'dompurify';

export function sanitizeHtml(rawHtml: string): string {
  return DOMPurify.sanitize(String(rawHtml ?? ''), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
  });
}

export function sanitizePlainText(raw: string): string {
  return DOMPurify.sanitize(String(raw ?? ''), {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}
