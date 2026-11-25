import React, { useMemo, useState } from 'react';
import { Download, Eye, FileSpreadsheet } from 'lucide-react';
import { biText } from '../data/i18n';
import { usePrms } from '../context/PrmsContext';
import { downloadExportFile } from '../utils/exportDownload';
import {
  ExportPreviewModal,
  GovernanceCallout,
  StatusLabel,
} from '../components/ui/Primitives';

type ReportId = 'income' | 'ageing' | 'occupancy' | 'collections' | 'audit' | 'tax';

export const ReportsPage: React.FC = () => {
  const {
    activeOwner,
    ownerUnits,
    ownerCharges,
    ownerReceipts,
    ownerTenants,
    ownerAuditEvents,
    ownerTaxRules,
    logReportExport,
    locale,
    fmtDate,
    fmtDateTime,
    fmtEtb,
  } = usePrms();

  const [selectedReport, setSelectedReport] = useState<ReportId>('income');
  const [dateFrom, setDateFrom] = useState('2026-09-01');
  const [dateTo, setDateTo] = useState('2026-12-31');
  const [methodFilter, setMethodFilter] = useState<
    'All' | 'Cash' | 'Bank Transfer' | 'Cheque' | 'Telebirr (Synthetic)' | 'ArifPay (Synthetic)'
  >('All');
  const [previewFormat, setPreviewFormat] = useState<'PDF' | 'Excel' | null>(null);

  const reportCatalogue: { id: ReportId; title: string; summary: string }[] = useMemo(
    () => [
      {
        id: 'income',
        title: biText(locale, 'Owner Income Statement (Synthetic)', 'የባለቤት የገቢ መግለጫ (ሰው-ሠራሽ)'),
        summary: biText(
          locale,
          'Billed rental revenue vs. simulated collections scoped strictly to the active owner.',
          'ለተመረጠው ባለቤት ብቻ የተጠየቀ ኪራይና የተሰበሰበ ገቢ ንጽጽር።'
        ),
      },
      {
        id: 'ageing',
        title: biText(locale, 'Receivables Ageing', 'ያልተሰበሰቡ ሂሳቦች ዕድሜ ሪፖርት'),
        summary: biText(
          locale,
          'Open and overdue synthetic tenant balances segmented by invoice period.',
          'ክፍትና ጊዜያቸው ያለፈባቸው ሰው-ሠራሽ የተከራይ ቀሪዎች።'
        ),
      },
      {
        id: 'occupancy',
        title: biText(locale, 'Occupancy Report', 'የክፍሎች መከራየት ሪፖርት'),
        summary: biText(
          locale,
          'Unit occupancy breakdown across Vacant, Occupied, Maintenance, Reserved, and Inactive states.',
          'በክፍት፣ በተከራየ፣ በጥገና፣ በተያዘና በቦዘነ ሁኔታ ያሉ ክፍሎች ዝርዝር።'
        ),
      },
      {
        id: 'collections',
        title: biText(locale, 'Collections Summary', 'የገቢ አሰባሰብ ማጠቃለያ'),
        summary: biText(
          locale,
          'Synthetic Cash, Bank Transfer, and Cheque receipts with reversal visibility.',
          'ሰው-ሠራሽ በጥሬ ገንዘብ፣ በባንክ ዝውውርና በቼክ የተሰበሰቡ ደረሰኞች ከመመለስ ታሪክ ጋር።'
        ),
      },
      {
        id: 'audit',
        title: biText(locale, 'Immutable Audit Report', 'የማይለወጥ የኦዲት ሪፖርት'),
        summary: biText(
          locale,
          'Chronological governance and mutation log for the selected owner and date window.',
          'ለተመረጠው ባለቤትና የቀን ክልል የአስተዳደርና የለውጥ ታሪክ።'
        ),
      },
      {
        id: 'tax',
        title: biText(locale, 'Tax Summary (Illustrative Drafts Only)', 'የታክስ ማጠቃለያ (ለማሳያ ረቂቅ ብቻ)'),
        summary: biText(
          locale,
          'Lists synthetic non-active tax draft configurations; computes zero statutory tax.',
          'ንቁ ያልሆኑ ሰው-ሠራሽ የታክስ ረቂቆችን ይዘረዝራል፤ ምንም ሕጋዊ ታክስ አያሰላም።'
        ),
      },
    ],
    [locale]
  );

  const activeReportMeta =
    reportCatalogue.find((r) => r.id === selectedReport) || reportCatalogue[0];

  const incomeMetrics = useMemo(() => {
    const billed = ownerCharges.reduce((s, c) => s + c.billedEtb, 0);
    const collected = ownerReceipts
      .filter((r) => r.documentState !== 'Reversed')
      .reduce((s, r) => s + r.amountEtb, 0);
    const open = ownerCharges.reduce((s, c) => s + Math.max(0, c.billedEtb - c.paidEtb), 0);
    return { billed, collected, open };
  }, [ownerCharges, ownerReceipts]);

  const filteredReceipts = useMemo(
    () =>
      ownerReceipts.filter((r) => {
        if (methodFilter !== 'All' && r.method !== methodFilter) return false;
        return r.paymentDate >= dateFrom && r.paymentDate <= dateTo;
      }),
    [ownerReceipts, methodFilter, dateFrom, dateTo]
  );

  const exportPreviewData = useMemo(() => {
    if (selectedReport === 'income') {
      return {
        columns: ['Metric', 'Amount (ETB Synthetic)', 'Status'],
        rows: [
          ['Total Billed', fmtEtb(incomeMetrics.billed), 'Synthetic Demo'],
          ['Total Collected', fmtEtb(incomeMetrics.collected), 'Synthetic Demo'],
          ['Outstanding Receivables', fmtEtb(incomeMetrics.open), 'Synthetic Demo'],
        ],
      };
    }
    if (selectedReport === 'ageing') {
      return {
        columns: ['Invoice', 'Due Date', 'Open Balance', 'Status'],
        rows: ownerCharges.map((c) => [
          c.invoiceNumber,
          fmtDate(c.dueDate),
          fmtEtb(Math.max(0, c.billedEtb - c.paidEtb)),
          c.status,
        ]),
      };
    }
    if (selectedReport === 'occupancy') {
      return {
        columns: ['Unit', 'Floor', 'Area (sqm)', 'Status'],
        rows: ownerUnits.map((u) => [u.name, String(u.floor), String(u.areaSqm), u.status]),
      };
    }
    if (selectedReport === 'collections') {
      return {
        columns: ['Receipt #', 'Date', 'Method', 'Amount', 'Status'],
        rows: filteredReceipts.map((r) => [
          r.receiptNumber,
          fmtDate(r.paymentDate),
          r.method,
          fmtEtb(r.amountEtb),
          r.documentState,
        ]),
      };
    }
    if (selectedReport === 'audit') {
      return {
        columns: ['Timestamp', 'Actor', 'Module', 'Action'],
        rows: ownerAuditEvents.map((e) => [
          fmtDateTime(e.timestamp),
          `${e.actor} (${e.actorId})`,
          e.module,
          e.action,
        ]),
      };
    }
    return {
      columns: ['Rule Code', 'Category', 'Placeholder', 'Lifecycle'],
      rows: ownerTaxRules.map((t) => [t.code, t.taxCategory, t.ratePlaceholder, t.lifecycleStage]),
    };
  }, [
    selectedReport,
    incomeMetrics,
    ownerCharges,
    ownerUnits,
    filteredReceipts,
    ownerAuditEvents,
    ownerTaxRules,
    fmtDate,
    fmtDateTime,
    fmtEtb,
  ]);

  return (
    <div className="space-y-6">
      <GovernanceCallout
        title={biText(
          locale,
          'Illustrative Synthetic Reports — Not a Production Financial Statement',
          'ለማሳያ የቀረቡ ሰው-ሠራሽ ሪፖርቶች — የምርት የፋይናንስ መግለጫ አይደለም'
        )}
        description={biText(
          locale,
          `All figures and previews are strictly scoped to ${activeOwner.name}. Exports are prototype simulations and carry SYNTHETIC DEMO DATA disclaimers.`,
          `ሁሉም አኃዞች ለ ${activeOwner.name} ብቻ የተገደቡ ናቸው። የወጪ ፋይሎች የፕሮቶታይፕ ማስመሰያዎች ሲሆኑ SYNTHETIC DEMO DATA ማስጠንቀቂያ ይይዛሉ።`
        )}
        variant="warning"
        controlType="Prototype Simulation"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Catalogue List */}
        <aside className="lg:col-span-4 space-y-2">
          {reportCatalogue.map((rep) => {
            const active = rep.id === selectedReport;
            return (
              <button
                key={rep.id}
                type="button"
                onClick={() => setSelectedReport(rep.id)}
                className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                  active
                    ? 'border-[#166549] dark:border-emerald-500/70 bg-emerald-50/50 dark:bg-emerald-950/30'
                    : 'border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#111C2C] hover:bg-[#F8FAFC] dark:hover:bg-[#152236]'
                }`}
              >
                <p className="text-xs font-bold text-[#0F233A] dark:text-slate-100">{rep.title}</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{rep.summary}</p>
              </button>
            );
          })}
        </aside>

        {/* Report Preview & Controls */}
        <section className="lg:col-span-8 bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden flex flex-col shadow-xs">
          <div className="px-5 py-4 border-b border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
                {activeReportMeta.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {biText(locale, 'Owner Scope:', 'የባለቤት ክልል:')} {activeOwner.name} ·{' '}
                {biText(locale, 'Not a production financial statement', 'የምርት የፋይናንስ መግለጫ አይደለም')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  downloadExportFile('PDF', {
                    title: activeReportMeta.title,
                    ownerName: activeOwner.name,
                    columns: exportPreviewData.columns,
                    rows: exportPreviewData.rows,
                  });
                  logReportExport(activeReportMeta.title, 'PDF');
                }}
                className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#162438] hover:bg-slate-50 dark:hover:bg-[#1D2E48] text-xs font-semibold text-[#0F233A] dark:text-slate-100 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{biText(locale, 'Download PDF', 'PDF አውርድ')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  downloadExportFile('Excel', {
                    title: activeReportMeta.title,
                    ownerName: activeOwner.name,
                    columns: exportPreviewData.columns,
                    rows: exportPreviewData.rows,
                  });
                  logReportExport(activeReportMeta.title, 'Excel');
                }}
                className="px-3 py-1.5 rounded-lg bg-[#166549] hover:bg-[#12533B] dark:bg-[#248F64] dark:hover:bg-[#1E7A55] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{biText(locale, 'Download Excel (.xlsx)', 'Excel (.xlsx) አውርድ')}</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewFormat('PDF')}
                className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#162438] hover:bg-slate-50 dark:hover:bg-[#1D2E48] text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{biText(locale, 'Export Options', 'የወጪ አማራጮች')}</span>
              </button>
            </div>
          </div>

          {/* Filter Strip */}
          <div className="px-5 py-3 border-b border-[#DFE5EE] dark:border-[#233349] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white dark:bg-[#111C2C]">
            <div>
              <label className="text-slate-500 dark:text-slate-400 font-medium block mb-1">
                {biText(locale, 'From Date', 'ከቀን')}
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="text-slate-500 dark:text-slate-400 font-medium block mb-1">
                {biText(locale, 'To Date', 'እስከ ቀን')}
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="text-slate-500 dark:text-slate-400 font-medium block mb-1">
                {biText(locale, 'Method Filter (Collections)', 'የክፍያ ዘዴ ማጣሪያ')}
              </label>
              <select
                value={methodFilter}
                onChange={(e) =>
                  setMethodFilter(
                    e.target.value as
                      | 'All'
                      | 'Cash'
                      | 'Bank Transfer'
                      | 'Cheque'
                      | 'Telebirr (Synthetic)'
                      | 'ArifPay (Synthetic)'
                  )
                }
                className="w-full px-2.5 py-1.5 border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-slate-900 dark:text-slate-100 rounded-lg"
              >
                <option value="All">{biText(locale, 'All Methods', 'ሁሉም ዘዴዎች')}</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Telebirr (Synthetic)">Telebirr (Synthetic)</option>
                <option value="ArifPay (Synthetic)">ArifPay (Synthetic)</option>
              </select>
            </div>
          </div>

          {/* On-Screen Report Body */}
          <div className="p-5 space-y-4 text-xs">
            {selectedReport === 'income' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236]">
                    <p className="text-slate-500 dark:text-slate-400">
                      {biText(locale, 'Total Billed (Synthetic)', 'ጠቅላላ የተጠየቀ (ሰው-ሠራሽ)')}
                    </p>
                    <p className="text-base font-bold font-mono text-[#0F233A] dark:text-slate-100 tabular-nums mt-1">
                      {fmtEtb(incomeMetrics.billed)}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236]">
                    <p className="text-slate-500 dark:text-slate-400">
                      {biText(locale, 'Total Collected (Synthetic)', 'ጠቅላላ የተሰበሰበ (ሰው-ሠራሽ)')}
                    </p>
                    <p className="text-base font-bold font-mono text-[#166549] dark:text-emerald-400 tabular-nums mt-1">
                      {fmtEtb(incomeMetrics.collected)}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-[#F8FAFC] dark:bg-[#152236]">
                    <p className="text-slate-500 dark:text-slate-400">
                      {biText(locale, 'Outstanding Receivables', 'ያልተሰበሰበ ቀሪ')}
                    </p>
                    <p className="text-base font-bold font-mono text-red-700 dark:text-red-400 tabular-nums mt-1">
                      {fmtEtb(incomeMetrics.open)}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {biText(
                    locale,
                    'Disclaimer: Synthetic operating totals only. Not a production income statement; excludes expenses, depreciation, opening balances, and statutory tax filings.',
                    'ማሳሰቢያ፡ ሰው-ሠራሽ የሥራ አኃዞች ብቻ ናቸው። የምርት የገቢ መግለጫ አይደለም፤ ወጪዎችን፣ የእርጅና ቅናሽን፣ የመክፈቻ ሚዛኖችንና ሕጋዊ የታክስ መግለጫዎችን አያካትትም።'
                  )}
                </p>
              </div>
            )}

            {selectedReport === 'ageing' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-[#DFE5EE] dark:border-[#233349] rounded-lg overflow-hidden">
                  <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Invoice', 'ደረሰኝ')}</th>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Tenant', 'ተከራይ')}</th>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Due Date', 'የመክፈያ ቀን')}</th>
                      <th className="py-2.5 px-3 font-semibold text-right">
                        {biText(locale, 'Open Balance', 'ቀሪ ሂሳብ')}
                      </th>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Status', 'ሁኔታ')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                    {ownerCharges.map((c) => (
                      <tr key={c.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80">
                        <td className="py-2.5 px-3 font-mono text-[#0F233A] dark:text-[#E5B85C]">
                          {c.invoiceNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                          {ownerTenants.find((t) => t.id === c.tenantId)?.name}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {fmtDate(c.dueDate)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right tabular-nums text-slate-900 dark:text-slate-100">
                          {fmtEtb(Math.max(0, c.billedEtb - c.paidEtb))}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusLabel label={c.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedReport === 'occupancy' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-[#DFE5EE] dark:border-[#233349] rounded-lg overflow-hidden">
                  <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Unit', 'ክፍል')}</th>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Floor / Area', 'ፎቅ / ስፋት')}</th>
                      <th className="py-2.5 px-3 font-semibold text-right">
                        {biText(locale, 'Base Rent', 'መሠረታዊ ኪራይ')}
                      </th>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Status', 'ሁኔታ')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                    {ownerUnits.map((u) => (
                      <tr key={u.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80">
                        <td className="py-2.5 px-3 font-semibold text-[#0F233A] dark:text-slate-100">
                          {u.name}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                          {biText(locale, 'Floor', 'ፎቅ')} {u.floor} · {u.areaSqm} sqm
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right tabular-nums text-slate-900 dark:text-slate-100">
                          {fmtEtb(u.baseRentEtb)}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusLabel label={u.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedReport === 'collections' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-[#DFE5EE] dark:border-[#233349] rounded-lg overflow-hidden">
                  <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Receipt #', 'ደረሰኝ #')}</th>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Date', 'ቀን')}</th>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Method', 'ዘዴ')}</th>
                      <th className="py-2.5 px-3 font-semibold text-right">{biText(locale, 'Amount', 'መጠን')}</th>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Status', 'ሁኔታ')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                    {filteredReceipts.map((r) => (
                      <tr key={r.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80">
                        <td className="py-2.5 px-3 font-mono text-[#0F233A] dark:text-[#E5B85C]">
                          {r.receiptNumber}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {fmtDate(r.paymentDate)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">{r.method}</td>
                        <td className="py-2.5 px-3 font-mono text-right tabular-nums text-slate-900 dark:text-slate-100">
                          {fmtEtb(r.amountEtb)}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusLabel label={r.documentState} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedReport === 'audit' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-[#DFE5EE] dark:border-[#233349] rounded-lg overflow-hidden">
                  <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Timestamp', 'ሰዓትና ቀን')}</th>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Actor', 'ፈጻሚ')}</th>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Module', 'ክፍል')}</th>
                      <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Action', 'ተግባር')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                    {ownerAuditEvents.map((e) => (
                      <tr key={e.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80">
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {fmtDateTime(e.timestamp)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                          {e.actor} ({e.actorId})
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{e.module}</td>
                        <td className="py-2.5 px-3 font-semibold text-[#0F233A] dark:text-slate-100">
                          {e.action}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedReport === 'tax' && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-lg bg-red-50/80 dark:bg-red-950/30 border border-red-200 dark:border-red-800/70 text-red-900 dark:text-red-200">
                  {biText(
                    locale,
                    'Tax Summary Disclaimer: Zero active tax rules exist. All placeholders require licensed Ethiopian tax adviser confirmation and owner approval before production activation.',
                    'የታክስ ማጠቃለያ ማሳሰቢያ፡ ምንም ንቁ የታክስ ሕግ የለም። ሁሉም ምትኮች ወደ ምርት ከመግባታቸው በፊት የኢትዮጵያ ፈቃድ ያለው የታክስ አማካሪና የባለቤት ፈቃድ ይፈልጋሉ።'
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-[#DFE5EE] dark:border-[#233349] rounded-lg overflow-hidden">
                    <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Rule Code', 'የሕግ ኮድ')}</th>
                        <th className="py-2.5 px-3 font-semibold">{biText(locale, 'Category', 'ምድብ')}</th>
                        <th className="py-2.5 px-3 font-semibold">
                          {biText(locale, 'Rate / Threshold Placeholder', 'የምጣኔ / ገደብ ምትክ')}
                        </th>
                        <th className="py-2.5 px-3 font-semibold">
                          {biText(locale, 'Lifecycle Stage', 'የሕይወት ዑደት ደረጃ')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
                      {ownerTaxRules.map((t) => (
                        <tr key={t.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#152236]/80">
                          <td className="py-2.5 px-3 font-mono text-[#0F233A] dark:text-[#E5B85C]">
                            {t.code}
                          </td>
                          <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">{t.taxCategory}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                            {t.ratePlaceholder}
                          </td>
                          <td className="py-2.5 px-3">
                            <StatusLabel label={t.lifecycleStage} tone="red" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {previewFormat && (
        <ExportPreviewModal
          open={Boolean(previewFormat)}
          onClose={() => setPreviewFormat(null)}
          title={activeReportMeta.title}
          format={previewFormat}
          ownerName={activeOwner.name}
          rowCount={exportPreviewData.rows.length}
          previewColumns={exportPreviewData.columns}
          previewRows={exportPreviewData.rows}
          onConfirmExport={(fmt) =>
            logReportExport(activeReportMeta.title, fmt === 'PDF' ? 'PDF' : 'Excel')
          }
        />
      )}
    </div>
  );
};
