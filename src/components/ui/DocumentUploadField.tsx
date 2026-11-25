import React, { useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, FileText, Trash2, Upload } from 'lucide-react';
import {
  confirmDocumentUpload,
  getApiBaseUrl,
  presignDocumentUpload,
  uploadOfficeEvidenceFile,
} from '../../services/productionApiClient';

export interface UploadedEvidenceFile {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  objectKey: string;
  previewUrl?: string;
  downloadUrl?: string;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024;

async function computeSha256(file: File): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return `LOCAL-${file.size}-${Date.now()}`;
  }
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const DocumentUploadField: React.FC<{
  entityType: 'CBE_SLIP' | 'LEASE_PDF' | 'REPAIR_PHOTO' | 'TENANT_KYC' | 'ERCA_CERT';
  entityRefId?: string;
  ownerId?: string;
  label: string;
  helperText?: string;
  value: UploadedEvidenceFile | null;
  onChange: (file: UploadedEvidenceFile | null) => void;
}> = ({ entityType, entityRefId = '', ownerId = 'OWN-ALPHA', label, helperText, value, onChange }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Unsupported file format. Please upload JPEG, PNG, WEBP, or PDF.');
      return;
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      setError('File size must be under 10 MB.');
      return;
    }

    setUploading(true);
    try {
      let sha256 = await computeSha256(file);
      let objectKey = `sandbox/${entityType.toLowerCase()}/${sha256.slice(0, 12)}-${file.name}`;
      let downloadUrl: string | undefined;

      if (getApiBaseUrl()) {
        const presign = await presignDocumentUpload({
          entity_type: entityType,
          filename: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
        });
        const putRes = await fetch(presign.upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!putRes.ok) {
          throw new Error(`Object storage upload failed (${putRes.status})`);
        }
        await confirmDocumentUpload({
          entity_type: entityType,
          entity_ref_id: entityRefId,
          object_key: presign.object_key,
          filename: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
          sha256_checksum: sha256,
        });
        objectKey = presign.object_key;
      } else if (
        typeof window !== 'undefined' &&
        typeof fetch === 'function' &&
        window.location?.origin?.startsWith('http') &&
        (typeof navigator === 'undefined' || navigator.onLine)
      ) {
        try {
          const saved = await uploadOfficeEvidenceFile({
            file,
            entityType,
            entityRefId,
            ownerId,
          });
          objectKey = saved.objectKey;
          downloadUrl = saved.url;
          if (saved.sha256) sha256 = saved.sha256;
        } catch (err) {
          // Only surface validation errors; fallback cleanly if server is unreachable in offline/test mode
          if (err instanceof Error && /Unsupported|between 1 byte|binary header/i.test(err.message)) {
            throw err;
          }
        }
      }

      const localPreviewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      onChange({
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        sha256,
        objectKey,
        previewUrl: downloadUrl && file.type.startsWith('image/') ? downloadUrl : localPreviewUrl,
        downloadUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5 text-xs">
      <span className="block font-semibold text-slate-700 dark:text-slate-200">{label}</span>

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf"
        capture="environment"
        onChange={(e) => {
          void handleFileSelected(e.target.files?.[0]);
        }}
        className="sr-only"
      />

      {!value ? (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="w-full min-h-[52px] px-3 py-2.5 rounded-xl border border-dashed border-[#94A3B8] dark:border-[#364B6B] bg-[#F8FAFC] dark:bg-[#152236] hover:border-[#166549] dark:hover:border-emerald-400 flex items-center justify-center gap-2 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer transition-colors"
        >
          <Upload className="w-4 h-4 text-[#166549] dark:text-emerald-400 shrink-0" />
          <span>
            {uploading
              ? 'Uploading & hashing…'
              : helperText || 'Attach Image / PDF (max 10 MB)'}
          </span>
        </button>
      ) : (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/70 dark:bg-emerald-950/25 p-2.5 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {value.previewUrl ? (
              <img
                src={value.previewUrl}
                alt={value.filename}
                className="w-10 h-10 rounded-lg object-cover border border-slate-300 dark:border-slate-700 shrink-0"
              />
            ) : (
              <FileText className="w-5 h-5 text-[#166549] dark:text-emerald-400 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#166549] dark:text-emerald-400 shrink-0" />
                <span className="truncate">{value.filename}</span>
              </p>
              <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {Math.max(1, Math.round(value.sizeBytes / 1024))} KB · {value.sha256.slice(0, 12)}
                {value.downloadUrl ? ' · Saved to Office Vault' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {(value.downloadUrl || value.previewUrl) && (
              <a
                href={value.downloadUrl || value.previewUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open uploaded evidence"
                className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-[#166549] dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              type="button"
              aria-label="Remove attached file"
              onClick={() => onChange(null)}
              className="min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center text-red-600 hover:bg-red-100 dark:hover:bg-red-950/40 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-[11px] font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
};
