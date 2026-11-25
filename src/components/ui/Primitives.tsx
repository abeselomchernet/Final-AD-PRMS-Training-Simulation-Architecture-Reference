import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  FileWarning,
  Info,
  Lock,
  Printer,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { biText, localizeStatus, UI_LABELS } from '../../data/i18n';
import {
  downloadExportFile,
  ExportFileFormat,
  PdfOrientation,
  printExportDocument,
} from '../../utils/exportDownload';

export type StatusTone = 'green' | 'amber' | 'red' | 'navy' | 'slate';

const TONE_MAP: Record<StatusTone, string> = {
  green:
    'bg-emerald-50 text-emerald-900 border-emerald-200/90 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800/70',
  amber:
    'bg-amber-50 text-amber-900 border-amber-200/90 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-700/70',
  red: 'bg-red-50 text-red-900 border-red-200/90 dark:bg-red-950/50 dark:text-red-200 dark:border-red-800/70',
  navy: 'bg-slate-100 text-[#0F233A] border-slate-300 dark:bg-slate-800/80 dark:text-slate-100 dark:border-slate-700',
  slate:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700',
};

export function inferStatusTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (
    (s.includes('active') || s.includes('completed') || s.includes('pass')) &&
    !s.includes('not active') &&
    !s.includes('inactive') &&
    !s.includes('legal hold') &&
    !s.includes('not completed')
  ) {
    return 'green';
  }
  if (
    s === 'occupied' ||
    s === 'paid' ||
    s === 'approved' ||
    s.startsWith('issued') ||
    s === 'full' ||
    s === 'primary source identified' ||
    s === 'demonstrated in prototype'
  ) {
    return 'green';
  }
  if (
    s.includes('blocked') ||
    s.includes('conflicting') ||
    s.includes('overdue') ||
    s.includes('rejected') ||
    s.includes('void') ||
    s.includes('reversed') ||
    s.includes('terminated') ||
    s.includes('prohibited') ||
    s.includes('not active') ||
    s.includes('critical') ||
    s.includes('denied')
  ) {
    return 'red';
  }
  if (
    s.includes('pending') ||
    s.includes('expiring') ||
    s.includes('partial') ||
    s.includes('maintenance') ||
    s.includes('reserved') ||
    s.includes('returned') ||
    s.includes('draft') ||
    s.includes('submitted') ||
    s.includes('adviser') ||
    s.includes('owner decision') ||
    s.includes('owner authority-matrix') ||
    s.includes('secondary source') ||
    s.includes('unverified') ||
    s.includes('maker') ||
    s.includes('checker') ||
    s.includes('legal hold') ||
    s.includes('trainer')
  ) {
    return 'amber';
  }
  if (
    s === 'vacant' ||
    s === 'open' ||
    s === 'scheduled' ||
    s === 'renewed' ||
    s === 'not started' ||
    s === 'in progress'
  ) {
    return 'navy';
  }
  return 'slate';
}

export const StatusLabel: React.FC<{
  label: string;
  tone?: StatusTone;
}> = ({ label, tone }) => {
  const locale = useLocale();
  const resolved = tone || inferStatusTone(label);
  const displayLabel = localizeStatus(label, locale);
  const Icon =
    resolved === 'green'
      ? CheckCircle2
      : resolved === 'amber'
        ? Clock
        : resolved === 'red'
          ? XCircle
          : Info;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border whitespace-nowrap shrink-0 ${TONE_MAP[resolved]}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{displayLabel}</span>
    </span>
  );
};

export const GovernanceCallout: React.FC<{
  title: string;
  description: string;
  variant?: 'info' | 'warning' | 'restricted';
  controlType?: 'Prototype Simulation' | 'Production Boundary';
  action?: React.ReactNode;
}> = ({ title, description, variant = 'info', controlType, action }) => {
  const locale = useLocale();
  const styles =
    variant === 'warning'
      ? 'bg-amber-50/80 border-[#D9A441]/45 text-amber-950 dark:bg-amber-950/25 dark:border-amber-700/50 dark:text-amber-100'
      : variant === 'restricted'
        ? 'bg-red-50/80 border-red-200 text-red-950 dark:bg-red-950/30 dark:border-red-800/60 dark:text-red-100'
        : 'bg-white border-[#DFE5EE] text-[#0F1D2F] dark:bg-[#111C2C] dark:border-[#233349] dark:text-slate-100';

  const Icon =
    variant === 'warning' ? AlertTriangle : variant === 'restricted' ? Lock : ShieldAlert;

  return (
    <div
      className={`rounded-lg border px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${styles}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <Icon className="w-4 h-4 mt-0.5 shrink-0 opacity-85" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{title}</p>
            {controlType && (
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                · {localizeStatus(controlType, locale)}
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed opacity-90 mt-0.5">{description}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

export const EmptyState: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="border border-dashed border-slate-300 dark:border-[#2A3C54] rounded-lg bg-white dark:bg-[#111C2C] px-6 py-10 text-center">
    <FileWarning className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2.5" />
    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
    <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto mt-1">{description}</p>
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

export const ValidationSummary: React.FC<{
  errors: string[];
}> = ({ errors }) => {
  const locale = useLocale();
  if (!errors.length) return null;
  const labels = UI_LABELS[locale];
  return (
    <div
      role="alert"
      className="rounded-md border border-red-300 dark:border-red-800/70 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-xs text-red-950 dark:text-red-100 space-y-1"
    >
      <div className="flex items-center gap-1.5 font-semibold text-red-900 dark:text-red-200">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>{labels.validationSummaryTitle}</span>
      </div>
      <ul className="list-disc list-inside space-y-0.5 text-red-800 dark:text-red-200">
        {errors.map((err, idx) => (
          <li key={idx}>{err}</li>
        ))}
      </ul>
    </div>
  );
};

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidth?: string;
  isDirty?: boolean;
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, maxWidth = 'max-w-xl', isDirty = false, children }) => {
  const locale = useLocale();
  const labels = UI_LABELS[locale];
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  const attemptClose = () => {
    if (isDirty) {
      setConfirmDiscardOpen(true);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    if (!open) {
      setConfirmDiscardOpen(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmDiscardOpen) {
          setConfirmDiscardOpen(false);
        } else if (isDirty) {
          setConfirmDiscardOpen(true);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, isDirty, confirmDiscardOpen]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`w-full ${maxWidth} bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh] relative`}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F6F7F9] dark:bg-[#162438]">
          <div>
            <h2 className="text-base font-semibold text-[#0F233A] dark:text-slate-100">{title}</h2>
            {subtitle && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={attemptClose}
            className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {confirmDiscardOpen && (
          <div className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-300 dark:border-amber-700/60 px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2 text-amber-950 dark:text-amber-100">
              <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{labels.unsavedChangesTitle}</p>
                <p className="text-amber-900 dark:text-amber-200 mt-0.5">{labels.unsavedChangesBody}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmDiscardOpen(false)}
                className="px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#111C2C] text-slate-800 dark:text-slate-100 font-semibold cursor-pointer"
              >
                {labels.keepEditing}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDiscardOpen(false);
                  onClose();
                }}
                className="px-2.5 py-1.5 rounded bg-red-700 hover:bg-red-800 text-white font-semibold cursor-pointer"
              >
                {labels.discardClose}
              </button>
            </div>
          </div>
        )}

        <div className="p-5 overflow-y-auto text-slate-800 dark:text-slate-100">{children}</div>
      </div>
    </div>
  );
};

export const ConfirmDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: 'navy' | 'red' | 'green';
}> = ({ open, onClose, onConfirm, title, description, confirmLabel, tone = 'navy' }) => {
  const locale = useLocale();
  if (!open) return null;

  const btnStyle =
    tone === 'red'
      ? 'bg-red-700 hover:bg-red-800 text-white'
      : tone === 'green'
        ? 'bg-[#166549] hover:bg-[#11513A] dark:bg-[#248F64] dark:hover:bg-[#1E7A55] text-white'
        : 'bg-[#0F233A] hover:bg-[#173454] dark:bg-slate-200 dark:hover:bg-white dark:text-[#0F1D2F] text-white';

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-4 text-xs">
        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{description}</p>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-[#233349]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#162438] text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
          >
            {biText(locale, 'Cancel', 'ሰርዝ')}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-md font-semibold cursor-pointer transition-colors ${btnStyle}`}
          >
            {confirmLabel || biText(locale, 'Confirm Action', 'እርምጃውን አረጋግጥ')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export const SlideDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  widthClass?: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, widthClass = 'max-w-2xl', children }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex-1" onClick={onClose} />
      <div
        className={`w-full ${widthClass} bg-white dark:bg-[#111C2C] border-l border-[#DFE5EE] dark:border-[#233349] h-full flex flex-col shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F6F7F9] dark:bg-[#162438]">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#0F233A] dark:text-slate-100 truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700/60 transition-colors shrink-0 cursor-pointer"
            aria-label="Close detail drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 text-slate-800 dark:text-slate-100">{children}</div>
      </div>
    </div>
  );
};

export const KpiCard: React.FC<{
  label: string;
  value: string;
  subtext: string;
  accent?: 'default' | 'emerald' | 'gold';
  onClick?: () => void;
}> = ({ label, value, subtext, accent = 'default', onClick }) => {
  const Wrapper = onClick ? 'button' : 'div';
  const valueTone =
    accent === 'emerald'
      ? 'text-[#166549] dark:text-emerald-400'
      : accent === 'gold'
        ? 'text-[#9A6712] dark:text-[#E5B85C]'
        : 'text-[#0F233A] dark:text-slate-100';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`text-left bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-lg p-4 transition-colors duration-150 ${
        onClick
          ? 'hover:border-[#166549] dark:hover:border-emerald-500/70 hover:bg-[#FAFBFD] dark:hover:bg-[#162438] cursor-pointer'
          : ''
      }`}
    >
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{label}</p>
      <p className={`text-xl font-bold tabular-nums font-mono mt-1.5 truncate ${valueTone}`}>
        {value}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{subtext}</p>
    </Wrapper>
  );
};

export interface SavedFilterPreset<T = string> {
  id: string;
  label: string;
  value: T;
  count?: number;
}

export function SavedFilterBar<T extends string>({
  presets,
  activeValue,
  onSelect,
}: {
  presets: SavedFilterPreset<T>[];
  activeValue: T;
  onSelect: (val: T) => void;
}) {
  const locale = useLocale();
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1">
        {biText(locale, 'Saved Filters:', 'የተቀመጡ ማጣሪያዎች:')}
      </span>
      {presets.map((p) => {
        const active = p.value === activeValue;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.value)}
            className={`px-2.5 py-1 rounded border font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              active
                ? 'bg-[#0F233A] text-white border-[#0F233A] dark:bg-[#248F64] dark:text-white dark:border-[#248F64]'
                : 'bg-white dark:bg-[#162438] text-slate-700 dark:text-slate-200 border-[#DFE5EE] dark:border-[#233349] hover:bg-slate-50 dark:hover:bg-[#1D2E47]'
            }`}
          >
            {p.label}
            {typeof p.count === 'number' ? ` (${p.count})` : ''}
          </button>
        );
      })}
    </div>
  );
}

export const SortableTh: React.FC<{
  label: string;
  columnKey: string;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
  alignRight?: boolean;
}> = ({ label, columnKey, sortKey, sortDir, onSort, alignRight }) => {
  const active = sortKey === columnKey;
  return (
    <th className={`py-2.5 px-4 font-semibold ${alignRight ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={`inline-flex items-center gap-1 hover:text-[#0F233A] dark:hover:text-white cursor-pointer ${
          alignRight ? 'flex-row-reverse' : ''
        }`}
      >
        <span>{label}</span>
        {active ? (
          sortDir === 'asc' ? (
            <ArrowUp className="w-3 h-3 text-[#166549] dark:text-emerald-400" />
          ) : (
            <ArrowDown className="w-3 h-3 text-[#166549] dark:text-emerald-400" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-500" />
        )}
      </button>
    </th>
  );
};

export const PaginationBar: React.FC<{
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (nextPage: number) => void;
}> = ({ totalItems, page, pageSize, onPageChange }) => {
  const locale = useLocale();
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(totalItems, safePage * pageSize);

  return (
    <div className="px-4 py-2.5 border-t border-[#DFE5EE] dark:border-[#233349] bg-[#F6F7F9] dark:bg-[#162438] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
      <span className="font-mono tabular-nums">
        {biText(
          locale,
          `Showing ${start}–${end} of ${totalItems} synthetic records`,
          `${start}–${end} ከ ${totalItems} ሰው-ሠራሽ መዝገቦች እየታዩ ነው`
        )}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Previous page"
          className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#111C2C] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1D2E47] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>{biText(locale, 'Prev', 'ቀዳሚ')}</span>
        </button>
        <span className="px-2 font-mono tabular-nums text-slate-700 dark:text-slate-200">
          {safePage} / {totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Next page"
          className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#111C2C] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1D2E47] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 cursor-pointer"
        >
          <span>{biText(locale, 'Next', 'ቀጣይ')}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const ExportPreviewModal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  format: 'PDF' | 'Excel';
  ownerName: string;
  rowCount: number;
  previewColumns: string[];
  previewRows: string[][];
  onConfirmExport: (selectedFormat?: ExportFileFormat) => void;
}> = ({
  open,
  onClose,
  title,
  format,
  ownerName,
  rowCount,
  previewColumns,
  previewRows,
  onConfirmExport,
}) => {
  const locale = useLocale();
  const [selectedFormat, setSelectedFormat] = React.useState<ExportFileFormat>(format);
  const [pdfOrientation, setPdfOrientation] = React.useState<PdfOrientation>('portrait');
  const [includeMetadataHeader, setIncludeMetadataHeader] = React.useState(true);

  React.useEffect(() => {
    if (open) {
      setSelectedFormat(format);
    }
  }, [open, format]);

  const formatExtLabel =
    selectedFormat === 'PDF'
      ? '.pdf'
      : selectedFormat === 'Excel'
        ? '.xlsx'
        : '.csv';

  const exportDocPayload = {
    title,
    ownerName,
    columns: previewColumns,
    rows: previewRows,
    includeMetadataHeader,
    pdfOrientation,
  };

  const handleDownloadAndConfirm = () => {
    downloadExportFile(selectedFormat, exportDocPayload);
    onConfirmExport(selectedFormat);
    onClose();
  };

  const handlePrintSheet = () => {
    printExportDocument(exportDocPayload);
    onConfirmExport('PDF');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${biText(locale, 'Export Preview & Download', 'የወጪ ፋይል ቅድመ-ዕይታና ማውረጃ')}: ${title}`}
      subtitle={biText(
        locale,
        `Scoped strictly to ${ownerName} · ${rowCount} synthetic rows ready for ${selectedFormat} (${formatExtLabel})`,
        `ለ ${ownerName} ብቻ የተገደበ · ${rowCount} ሰው-ሠራሽ መስመሮች ለ ${selectedFormat} (${formatExtLabel}) ዝግጁ`
      )}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4 text-xs">
        <div className="p-3 rounded-md border border-[#D9A441]/50 bg-amber-50 dark:bg-amber-950/35 text-amber-950 dark:text-amber-100 font-semibold flex flex-wrap items-center justify-between gap-2">
          <span>SYNTHETIC DEMO DATA — NOT FOR PRODUCTION OR STATUTORY FILING USE</span>
          <span className="font-mono text-[11px]">
            {selectedFormat} ({formatExtLabel})
          </span>
        </div>

        {/* Download Options Strip */}
        <div className="rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Export file format">
            {(['PDF', 'Excel', 'CSV'] as const).map((fmt) => {
              const active = selectedFormat === fmt;
              const ext = fmt === 'PDF' ? '.pdf' : fmt === 'Excel' ? '.xlsx' : '.csv';
              return (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setSelectedFormat(fmt)}
                  className={`px-3 py-1.5 rounded-md font-semibold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0F233A] dark:bg-[#166549] text-white border-[#0F233A] dark:border-[#166549]'
                      : 'bg-white dark:bg-[#111C2C] text-slate-700 dark:text-slate-200 border-[#CBD5E1] dark:border-[#2D405B] hover:border-[#166549]'
                  }`}
                >
                  {fmt === 'PDF' ? (
                    <Printer className="w-3.5 h-3.5" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {fmt} ({ext})
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {selectedFormat === 'PDF' && (
              <div className="inline-flex items-center gap-1.5">
                <label htmlFor="pdf-orientation-select" className="text-slate-600 dark:text-slate-300 font-medium">
                  {biText(locale, 'Layout:', 'አቀማመጥ:')}
                </label>
                <select
                  id="pdf-orientation-select"
                  value={pdfOrientation}
                  onChange={(e) => setPdfOrientation(e.target.value as PdfOrientation)}
                  className="px-2 py-1 rounded border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#111C2C] text-slate-800 dark:text-slate-100 text-xs"
                >
                  <option value="portrait">{biText(locale, 'Portrait', 'ቁመት')}</option>
                  <option value="landscape">{biText(locale, 'Landscape', 'አግድም')}</option>
                </select>
              </div>
            )}

            <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-200 font-medium">
              <input
                type="checkbox"
                checked={includeMetadataHeader}
                onChange={(e) => setIncludeMetadataHeader(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>{biText(locale, 'Include owner & demo header', 'የባለቤትና DEMO ራስጌ አካትት')}</span>
            </label>
          </div>
        </div>

        <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-md overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F7F9] dark:bg-[#162438] border-b border-[#DFE5EE] dark:border-[#233349] text-slate-600 dark:text-slate-300">
              <tr>
                {previewColumns.map((col, idx) => (
                  <th key={idx} className="py-2 px-3 font-semibold whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1D2C42]">
              {previewRows.slice(0, 6).map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className="py-2 px-3 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rowCount > 6 && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {biText(
              locale,
              `Previewing first 6 rows. Downloading includes all ${rowCount} rows and records an immutable audit event.`,
              `ከ ${rowCount} መስመሮች የመጀመሪያዎቹ 6 ቀርበዋል። ማውረድ ሁሉንም ${rowCount} መስመሮች ያካትታል እንዲሁም በኦዲት መዝገብ ይጻፋል።`
            )}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#DFE5EE] dark:border-[#233349]">
          <button
            type="button"
            onClick={handlePrintSheet}
            className="px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#162438] text-slate-700 dark:text-slate-200 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{biText(locale, 'Print / Save PDF', 'አትም / PDF አስቀምጥ')}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#162438] text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
            >
              {biText(locale, 'Close', 'ዝጋ')}
            </button>
            <button
              type="button"
              data-testid="confirm-download-export-btn"
              onClick={handleDownloadAndConfirm}
              className="px-4 py-2 rounded-md bg-[#166549] hover:bg-[#11513A] dark:bg-[#248F64] dark:hover:bg-[#1E7A55] text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {biText(
                  locale,
                  `Download ${selectedFormat} (${formatExtLabel})`,
                  `${selectedFormat} (${formatExtLabel}) አውርድ`
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
