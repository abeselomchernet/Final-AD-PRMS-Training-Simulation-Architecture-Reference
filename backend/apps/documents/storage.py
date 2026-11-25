import io
from celery import shared_task
from django.conf import settings
from PIL import Image
from .models import DocumentAsset


def _get_s3_client():
    import boto3
    return boto3.client(
        's3',
        region_name=settings.AWS_S3_REGION_NAME,
        endpoint_url=settings.AWS_S3_ENDPOINT_URL,
    )


def generate_presigned_upload_url(*, object_key: str, mime_type: str) -> str:
    if settings.STORAGE_BACKEND == 'gcs':
        from google.cloud import storage
        client = storage.Client()
        blob = client.bucket(settings.GS_BUCKET_NAME).blob(object_key)
        return blob.generate_signed_url(version='v4', expiration=300, method='PUT', content_type=mime_type)

    return _get_s3_client().generate_presigned_url(
        'put_object',
        Params={'Bucket': settings.AWS_STORAGE_BUCKET_NAME, 'Key': object_key, 'ContentType': mime_type},
        ExpiresIn=300,
    )


def generate_presigned_download_url(*, object_key: str) -> str:
    if settings.STORAGE_BACKEND == 'gcs':
        from google.cloud import storage
        client = storage.Client()
        blob = client.bucket(settings.GS_BUCKET_NAME).blob(object_key)
        return blob.generate_signed_url(version='v4', expiration=300, method='GET')

    return _get_s3_client().generate_presigned_url(
        'get_object',
        Params={'Bucket': settings.AWS_STORAGE_BUCKET_NAME, 'Key': object_key},
        ExpiresIn=300,
    )


@shared_task
def sanitize_uploaded_document_async(document_id: str) -> None:
    """Strips EXIF GPS metadata from uploaded repair photos and CBE bank slips in private object storage."""
    doc = DocumentAsset.objects.filter(id=document_id).first()
    if not doc or not doc.mime_type.startswith('image/'):
        return
    if settings.STORAGE_BACKEND == 's3':
        client = _get_s3_client()
        obj = client.get_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=doc.object_key)
        raw = obj['Body'].read()
        img = Image.open(io.BytesIO(raw))
        clean_buf = io.BytesIO()
        img_format = img.format or 'JPEG'
        img.save(clean_buf, format=img_format)
        client.put_object(
            Bucket=settings.AWS_STORAGE_BUCKET_NAME,
            Key=doc.object_key,
            Body=clean_buf.getvalue(),
            ContentType=doc.mime_type,
        )
        doc.exif_stripped = True
        doc.save(update_fields=['exif_stripped'])
