import uuid
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.common.permissions import (
    AtomicRlsViewMixin,
    DenyAuditorWrites,
    bind_postgres_rls_owner,
    get_active_owner_code_for_request,
)
from apps.portfolio.models import OwnerEntity
from .models import DocumentAsset
from .storage import (
    generate_presigned_download_url,
    generate_presigned_upload_url,
    sanitize_uploaded_document_async,
)

ALLOWED_MIMES = {'image/jpeg', 'image/png', 'image/webp', 'application/pdf'}
TENANT_ALLOWED_ENTITY_TYPES = {
    DocumentAsset.EntityType.CBE_SLIP,
    DocumentAsset.EntityType.TENANT_KYC,
}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


class PresignUploadView(AtomicRlsViewMixin, APIView):
    permission_classes = [permissions.IsAuthenticated, DenyAuditorWrites]

    def post(self, request):
        mime_type = str(request.data.get('mime_type', '')).lower()
        try:
            size_bytes = int(request.data.get('file_size_bytes', 0))
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid file_size_bytes.'}, status=status.HTTP_400_BAD_REQUEST)

        entity_type = str(request.data.get('entity_type', DocumentAsset.EntityType.CBE_SLIP))
        entity_ref_id = str(request.data.get('entity_ref_id', ''))
        filename = str(request.data.get('filename', 'evidence.bin')).replace('/', '_')

        if entity_type not in DocumentAsset.EntityType.values:
            return Response({'detail': 'Invalid entity_type.'}, status=status.HTTP_400_BAD_REQUEST)
        if getattr(request.user, 'user_type', '') == 'TENANT':
            if entity_type not in TENANT_ALLOWED_ENTITY_TYPES:
                return Response({'detail': 'Tenants may only upload CBE_SLIP or TENANT_KYC evidence.'}, status=status.HTTP_403_FORBIDDEN)
            tenant_ref = str(getattr(request.user, 'tenant_id_ref', '') or '')
            if entity_ref_id and entity_ref_id != tenant_ref:
                return Response({'detail': 'Cross-tenant document upload reference rejected.'}, status=status.HTTP_403_FORBIDDEN)
        if mime_type not in ALLOWED_MIMES:
            return Response({'detail': 'Unsupported file type. Allowed: JPEG, PNG, WEBP, PDF.'}, status=status.HTTP_400_BAD_REQUEST)
        if size_bytes <= 0 or size_bytes > MAX_UPLOAD_BYTES:
            return Response({'detail': 'File must be between 1 byte and 10 MB.'}, status=status.HTTP_400_BAD_REQUEST)

        owner_code = get_active_owner_code_for_request(request.user, request)
        bind_postgres_rls_owner(owner_code)
        object_key = f'{owner_code}/{entity_type.lower()}/{uuid.uuid4().hex}-{filename}'
        upload_url = generate_presigned_upload_url(object_key=object_key, mime_type=mime_type)
        return Response({'object_key': object_key, 'upload_url': upload_url, 'expires_in_seconds': 300})


class ConfirmUploadView(AtomicRlsViewMixin, APIView):
    permission_classes = [permissions.IsAuthenticated, DenyAuditorWrites]

    def post(self, request):
        owner_code = get_active_owner_code_for_request(request.user, request)
        bind_postgres_rls_owner(owner_code)

        object_key = str(request.data.get('object_key', ''))
        if not object_key.startswith(f'{owner_code}/'):
            return Response({'detail': 'Object key does not match active owner scope.'}, status=status.HTTP_403_FORBIDDEN)

        entity_type = str(request.data.get('entity_type', ''))
        mime_type = str(request.data.get('mime_type', '')).lower()
        try:
            size_bytes = int(request.data.get('file_size_bytes', 0))
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid file_size_bytes.'}, status=status.HTTP_400_BAD_REQUEST)

        if entity_type not in DocumentAsset.EntityType.values:
            return Response({'detail': 'Invalid entity_type.'}, status=status.HTTP_400_BAD_REQUEST)
        if mime_type not in ALLOWED_MIMES or size_bytes <= 0 or size_bytes > MAX_UPLOAD_BYTES:
            return Response({'detail': 'Invalid mime_type or file size.'}, status=status.HTTP_400_BAD_REQUEST)

        entity_ref_id = str(request.data.get('entity_ref_id', ''))
        if getattr(request.user, 'user_type', '') == 'TENANT':
            if entity_type not in TENANT_ALLOWED_ENTITY_TYPES:
                return Response({'detail': 'Tenants may only confirm CBE_SLIP or TENANT_KYC uploads.'}, status=status.HTTP_403_FORBIDDEN)
            tenant_ref = str(getattr(request.user, 'tenant_id_ref', '') or '')
            entity_ref_id = tenant_ref

        owner = OwnerEntity.objects.filter(code=owner_code).first()
        if not owner:
            return Response({'detail': 'Owner entity not found.'}, status=status.HTTP_404_NOT_FOUND)

        doc = DocumentAsset.objects.create(
            owner=owner,
            entity_type=entity_type,
            entity_ref_id=entity_ref_id,
            object_key=object_key,
            original_filename=str(request.data.get('filename', 'evidence.bin'))[:255],
            mime_type=mime_type,
            file_size_bytes=size_bytes,
            sha256_checksum=str(request.data.get('sha256_checksum', ''))[:64],
            uploaded_by_actor_id=request.user.actor_id,
        )
        sanitize_uploaded_document_async.delay(str(doc.id))
        return Response({'id': str(doc.id), 'object_key': doc.object_key}, status=status.HTTP_201_CREATED)


class SignedDownloadView(AtomicRlsViewMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        owner_code = get_active_owner_code_for_request(request.user, request)
        bind_postgres_rls_owner(owner_code)

        doc = DocumentAsset.objects.select_related('owner').filter(id=pk).first()
        if not doc:
            return Response({'detail': 'Document not found.'}, status=status.HTTP_404_NOT_FOUND)

        allowed = list(getattr(request.user, 'allowed_owners', []) or [request.user.owner_code])
        if doc.owner.code != owner_code or doc.owner.code not in allowed:
            return Response({'detail': 'Forbidden cross-owner document access.'}, status=status.HTTP_403_FORBIDDEN)

        if getattr(request.user, 'user_type', '') == 'TENANT':
            tenant_ref = str(getattr(request.user, 'tenant_id_ref', '') or '')
            if doc.uploaded_by_actor_id != request.user.actor_id and doc.entity_ref_id != tenant_ref:
                return Response({'detail': 'Forbidden cross-tenant document access.'}, status=status.HTTP_403_FORBIDDEN)

        return Response({'download_url': generate_presigned_download_url(object_key=doc.object_key)})
