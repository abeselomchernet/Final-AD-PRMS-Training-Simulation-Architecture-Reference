import logging
import re


class PiiMaskingFilter(logging.Filter):
    """Redacts Ethiopian phone numbers, OTP codes, JWT bearer tokens, and TINs from application logs."""

    MSISDN_PATTERN = re.compile(r'(\+251[79]\d{2})\d{4}(\d{2})')
    BEARER_PATTERN = re.compile(r'(Bearer\s+)[A-Za-z0-9\-_\.]+', re.IGNORECASE)
    OTP_PATTERN = re.compile(r'(otp["\']?\s*[:=]\s*["\']?)\d{4,8}', re.IGNORECASE)

    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        msg = self.MSISDN_PATTERN.sub(r'\1****\2', msg)
        msg = self.BEARER_PATTERN.sub(r'\1[REDACTED]', msg)
        msg = self.OTP_PATTERN.sub(r'\1[REDACTED]', msg)
        record.msg = msg
        record.args = ()
        return True
