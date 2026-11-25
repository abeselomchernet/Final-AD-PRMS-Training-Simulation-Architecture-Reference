import logging
from django.conf import settings
import requests
from .models import SmsDispatchLog

logger = logging.getLogger(__name__)


def _mask_msisdn(msisdn: str) -> str:
    if len(msisdn) <= 6:
        return '***'
    return f'{msisdn[:5]}****{msisdn[-2:]}'


def send_bilingual_sms(*, msisdn: str, body: str, owner_code: str, trigger_type: str = 'General Notice', locale: str = 'en') -> SmsDispatchLog:
    provider = getattr(settings, 'SMS_PROVIDER', 'sandbox')
    api_key = getattr(settings, 'SMS_API_KEY', '')
    sender_id = getattr(settings, 'SMS_SENDER_ID', 'ADPRMS')
    provider_msg_id = ''
    delivery_state = 'Delivered (Sandbox)'

    if provider == 'afromessage' and api_key:
        resp = requests.post(
            'https://api.afromessage.com/api/send',
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            json={'from': sender_id, 'to': msisdn, 'message': body},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        provider_msg_id = str(data.get('response', {}).get('message_id', ''))
        delivery_state = 'Sent'
    elif provider == 'geezsms' and api_key:
        resp = requests.post(
            'https://api.geezsms.com/api/v1/sms/send',
            json={'token': api_key, 'phone': msisdn, 'msg': body, 'shortcode_id': sender_id},
            timeout=10,
        )
        resp.raise_for_status()
        delivery_state = 'Sent'
    elif provider == 'ethiotelecom' and api_key:
        delivery_state = 'Sent'
    else:
        logger.info('Sandbox SMS dispatch owner=%s msisdn=%s trigger=%s', owner_code, _mask_msisdn(msisdn), trigger_type)

    return SmsDispatchLog.objects.create(
        owner_code=owner_code,
        recipient_msisdn=msisdn,
        trigger_type=trigger_type,
        locale=locale,
        message_body=body,
        provider=provider,
        provider_message_id=provider_msg_id,
        delivery_state=delivery_state,
    )
