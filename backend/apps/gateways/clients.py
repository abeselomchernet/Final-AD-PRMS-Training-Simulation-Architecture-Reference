import base64
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import hmac
import json
import time
from typing import Any
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from django.conf import settings
import requests


def _quantize_etb(amount_etb: Decimal | int | float | str) -> Decimal:
    return Decimal(str(amount_etb)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def verify_arifpay_hmac(raw_body: bytes, received_signature: str) -> bool:
    secret = getattr(settings, 'ARIFPAY_WEBHOOK_SECRET', '') or ''
    if not secret or not received_signature:
        return False
    expected = hmac.new(secret.encode('utf-8'), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, received_signature.strip())


def create_arifpay_live_session(*, nonce: str, amount_etb: Decimal | int | float | str, msisdn: str, notify_url: str, return_url: str) -> dict[str, Any]:
    api_key = getattr(settings, 'ARIFPAY_API_KEY', '') or ''
    base_url = getattr(settings, 'ARIFPAY_BASE_URL', 'https://gateway.arifpay.org/api').rstrip('/')
    if not api_key:
        raise RuntimeError('ARIFPAY_API_KEY is not configured.')

    quantized = _quantize_etb(amount_etb)
    if quantized <= Decimal('0.00'):
        raise ValueError('amount_etb must be strictly positive.')

    payload = {
        'cancelUrl': return_url,
        'errorUrl': return_url,
        'successUrl': return_url,
        'notifyUrl': notify_url,
        'phone': msisdn,
        'nonce': nonce,
        'paymentMethods': ['TELEBIRR', 'CBE'],
        'items': [{'name': 'AD-PRMS Rent Settlement', 'quantity': 1, 'price': str(quantized)}],
    }
    resp = requests.post(
        f'{base_url}/checkout/session',
        headers={'x-arifpay-key': api_key, 'Content-Type': 'application/json'},
        json=payload,
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def fetch_arifpay_session_status(session_id: str) -> dict[str, Any]:
    api_key = getattr(settings, 'ARIFPAY_API_KEY', '') or ''
    base_url = getattr(settings, 'ARIFPAY_BASE_URL', 'https://gateway.arifpay.org/api').rstrip('/')
    resp = requests.get(
        f'{base_url}/checkout/session/{session_id}',
        headers={'x-arifpay-key': api_key},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def sign_telebirr_rsa(params: dict[str, Any]) -> str:
    pem = getattr(settings, 'TELEBIRR_PRIVATE_KEY_PEM', '') or ''
    if not pem:
        raise RuntimeError('TELEBIRR_PRIVATE_KEY_PEM is not configured.')
    filtered = {k: v for k, v in params.items() if v is not None and v != '' and k not in ('sign', 'sign_type')}
    canonical = '&'.join(f'{k}={filtered[k]}' for k in sorted(filtered.keys()))
    private_key = serialization.load_pem_private_key(pem.encode('utf-8'), password=None)
    signature = private_key.sign(canonical.encode('utf-8'), padding.PKCS1v15(), hashes.SHA256())
    return base64.b64encode(signature).decode('utf-8')


def verify_telebirr_rsa(payload: dict[str, Any], signature_b64: str) -> bool:
    pem = getattr(settings, 'TELEBIRR_PUBLIC_KEY_PEM', '') or ''
    if not pem or not signature_b64:
        return False
    filtered = {k: v for k, v in payload.items() if v is not None and v != '' and k not in ('sign', 'sign_type')}
    canonical = '&'.join(f'{k}={filtered[k]}' for k in sorted(filtered.keys()))
    public_key = serialization.load_pem_public_key(pem.encode('utf-8'))
    try:
        public_key.verify(
            base64.b64decode(signature_b64),
            canonical.encode('utf-8'),
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
        return True
    except Exception:
        return False


def initiate_telebirr_preorder(*, merch_order_id: str, amount_etb: Decimal | int | float | str, title: str, notify_url: str, redirect_url: str) -> dict[str, Any]:
    base_url = getattr(settings, 'TELEBIRR_BASE_URL', '').rstrip('/')
    app_id = getattr(settings, 'TELEBIRR_FABRIC_APP_ID', '')
    app_secret = getattr(settings, 'TELEBIRR_APP_SECRET', '')
    merch_code = getattr(settings, 'TELEBIRR_MERCHANT_CODE', '')
    if not (base_url and app_id and app_secret and merch_code):
        raise RuntimeError('Telebirr merchant credentials are not fully configured.')

    quantized = _quantize_etb(amount_etb)
    if quantized <= Decimal('0.00'):
        raise ValueError('amount_etb must be strictly positive.')

    token_resp = requests.post(
        f'{base_url}/payment/v1/token',
        headers={'X-APP-Key': app_id, 'Content-Type': 'application/json'},
        json={'appSecret': app_secret},
        timeout=15,
    )
    token_resp.raise_for_status()
    fabric_token = token_resp.json().get('token', '')

    biz_content = {
        'appid': app_id,
        'merch_code': merch_code,
        'merch_order_id': merch_order_id,
        'trade_type': 'Checkout',
        'title': title,
        'total_amount': f'{quantized:.2f}',
        'trans_currency': 'ETB',
        'notify_url': notify_url,
        'redirect_url': redirect_url,
    }
    order_payload = {
        'timestamp': str(int(time.time())),
        'nonce_str': hashlib.sha256(f'{merch_order_id}:{time.time()}'.encode('utf-8')).hexdigest()[:32],
        'method': 'payment.preorder',
        'version': '1.0',
        'biz_content': json.dumps(biz_content, separators=(',', ':')),
    }
    order_payload['sign'] = sign_telebirr_rsa({**biz_content, 'timestamp': order_payload['timestamp'], 'nonce_str': order_payload['nonce_str']})
    order_payload['sign_type'] = 'SHA256WithRSA'

    pre_resp = requests.post(
        f'{base_url}/payment/v1/merchant/preOrder',
        headers={'X-APP-Key': app_id, 'Authorization': fabric_token, 'Content-Type': 'application/json'},
        json=order_payload,
        timeout=15,
    )
    pre_resp.raise_for_status()
    return pre_resp.json()
