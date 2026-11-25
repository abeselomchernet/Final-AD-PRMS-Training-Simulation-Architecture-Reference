import React, { useMemo, useState } from 'react';
import { Download, FilePlus2, FileText, Printer, RefreshCw } from 'lucide-react';
import { biText } from '../data/i18n';
import { usePrms } from '../context/PrmsContext';
import {
  buildOromifaContractExportRows,
  printOromifaContractDocument,
  recalculateOromifaFinancials,
} from '../data/oromifaContractTemplate';
import { checkActionPermission } from '../policies/rbac';
import { LeaseRecord, LeaseStatus, TenantRecord } from '../types/prms';
import { downloadExportFile } from '../utils/exportDownload';
import { OromifaContractBuilder } from '../components/leases/OromifaContractBuilder';
import {
  EmptyState,
  GovernanceCallout,
  Modal,
  SlideDrawer,
  StatusLabel,
} from '../components/ui/Primitives';

const LEASE_STATUSES: ('All' | LeaseStatus)[] = [
  'All',
  'Draft',
  'Active',
  'Expiring Soon',
  'Renewed',
  'Terminated',
];

export const TenantsLeasesPage: React.FC = () => {
  const {
    activeOwner,
    currentPersona,
    ownerTenants,
    ownerLeases,
    ownerUnits,
    ownerOromifaTemplates,
    createLease,
    renewLease,
    locale,
    fmtDate,
    fmtEtb,
    trStatus,
    labels,
  } = usePrms();

  const [tab, setTab] = useState<'leases' | 'tenants' | 'oromifa-contracts'>('leases');
  const [leaseFilter, setLeaseFilter] = useState<'All' | LeaseStatus>('All');
  const [selectedTenant, setSelectedTenant] = useState<TenantRecord | null>(null);
  const [selectedLease, setSelectedLease] = useState<LeaseRecord | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [wizardError, setWizardError] = useState('');
  const [wizardForm, setWizardForm] = useState({
    unitId: '',
    tenantId: '',
    startDate: '2026-12-01',
    endDate: '2027-11-30',
    monthlyRentEtb: 40000,
    securityDepositEtb: 80000,
    contractTemplateId: '',
    includeVat15: false,
    advanceMonths: 3,
    evidenceRef: 'EVD-LSE-SYNTH-NEW',
    notes: 'Synthetic lease created via prototype wizard.',
  });

  const [renewTarget, setRenewTarget] = useState<LeaseRecord | null>(null);
  const [renewForm, setRenewForm] = useState({
    newStartDate: '2026-12-01',
    newEndDate: '2027-11-30',
    newMonthlyRentEtb: 35000,
    evidenceRef: 'EVD-RENEW-SYNTH-V2',
    notes: 'Non-destructive renewal creating new version while retaining prior version.',
  });

  const canCreateLease = checkActionPermission(currentPersona.role, 'create_lease');
  const canRenewLease = checkActionPermission(currentPersona.role, 'renew_lease');

  const filteredLeases = useMemo(
    () =>
      leaseFilter === 'All'
        ? ownerLeases
        : ownerLeases.filter((l) => l.status === leaseFilter),
    [ownerLeases, leaseFilter]
  );

  const vacantUnits = useMemo(
    () => ownerUnits.filter((u) => u.status === 'Vacant' || u.status === 'Reserved'),
    [ownerUnits]
  );

  const openWizard = () => {
    setWizardStep(1);
    setWizardError('');
    setWizardForm({
      unitId: vacantUnits[0]?.id || '',
      tenantId: ownerTenants[0]?.id || '',
      startDate: '2026-12-01',
      endDate: '2027-11-30',
      monthlyRentEtb: vacantUnits[0]?.baseRentEtb || 40000,
      securityDepositEtb: (vacantUnits[0]?.baseRentEtb || 40000) * 2,
      contractTemplateId: ownerOromifaTemplates[0]?.id || '',
      includeVat15: false,
      advanceMonths: 3,
      evidenceRef: 'EVD-LSE-SYNTH-NEW',
      notes: 'Synthetic lease created via prototype wizard.',
    });
    setWizardOpen(true);
  };

  const handleWizardNext = () => {
    if (!wizardForm.unitId || !wizardForm.tenantId) {
      setWizardError(
        biText(locale, 'Select both a synthetic unit and a synthetic tenant.', 'ሰው-ሠራሽ ክፍል እና ተከራይ ይምረጡ።')
      );
      return;
    }
    if (wizardForm.endDate <= wizardForm.startDate) {
      setWizardError(
        biText(locale, 'Lease end date must be after start date.', 'የውሉ መጨረሻ ቀን ከመጀመሪያው ቀን በኋላ መሆን አለበት።')
      );
      return;
    }
    setWizardError('');
    setWizardStep(2);
  };

  const handleWizardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (wizardForm.monthlyRentEtb <= 0 || !wizardForm.evidenceRef.trim()) {
      setWizardError(
        biText(locale, 'Monthly rent and evidence reference are required.', 'ወርሃዊ ኪራይና የማስረጃ ማጣቀሻ ያስፈልጋሉ።')
      );
      return;
    }
    const chosenTpl = wizardForm.contractTemplateId
      ? ownerOromifaTemplates.find((t) => t.id === wizardForm.contractTemplateId)
      : undefined;
    const tenant = ownerTenants.find((t) => t.id === wizardForm.tenantId);
    const unit = ownerUnits.find((u) => u.id === wizardForm.unitId);
    const oromifaContract = chosenTpl
      ? recalculateOromifaFinancials({
          ...chosenTpl.data,
          landlordTitleAndName: activeOwner.name,
          landlordAddress: activeOwner.addressPlaceholder,
          landlordPhone: activeOwner.contactPlaceholder,
          landlordTin: activeOwner.tinPlaceholder,
          landlordVat: activeOwner.vatRegPlaceholder,
          tenantTitleAndName: tenant?.name || chosenTpl.data.tenantTitleAndName,
          tenantPhone: tenant?.phonePlaceholder || chosenTpl.data.tenantPhone,
          tenantTin: tenant?.idPlaceholder || chosenTpl.data.tenantTin,
          unitRoomLabel: unit
            ? `${unit.code} — ${unit.name} (Fooqii ${unit.floor})`
            : chosenTpl.data.unitRoomLabel,
          baseMonthlyRentEtb: wizardForm.monthlyRentEtb,
          vatRatePercent: wizardForm.includeVat15 ? 15 : 0,
          advanceMonths: wizardForm.advanceMonths,
          signatureLandlordName: activeOwner.name,
          signatureTenantName: tenant?.name || chosenTpl.data.signatureTenantName,
        })
      : undefined;

    if (
      createLease({
        unitId: wizardForm.unitId,
        tenantId: wizardForm.tenantId,
        startDate: wizardForm.startDate,
        endDate: wizardForm.endDate,
        monthlyRentEtb: oromifaContract
          ? oromifaContract.grossMonthlyRentEtb
          : wizardForm.monthlyRentEtb,
        securityDepositEtb: wizardForm.securityDepositEtb,
        evidenceRef: wizardForm.evidenceRef,
        notes: wizardForm.notes,
        contractLanguage: oromifaContract ? 'om' : undefined,
        oromifaContract,
      })
    ) {
      setWizardOpen(false);
    }
  };

  const handleRenewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewTarget || renewForm.newEndDate <= renewForm.newStartDate) return;
    if (
      renewLease({
        leaseId: renewTarget.id,
        ...renewForm,
      })
    ) {
      setRenewTarget(null);
      setSelectedLease(null);
    }
  };

  const inputCls =
    'w-full px-3 py-2 bg-white dark:bg-[#162438] border border-[#CBD5E1] dark:border-[#2D405B] rounded-lg text-[#0F1D2F] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#166549]';

  return (
    <div className="space-y-6">
      <GovernanceCallout
        title={biText(
          locale,
          'Prototype for Planned Lease & Tenant Functionality — Not Approved Production Records',
          'ለታቀደው የውልና የተከራይ አስተዳደር ፕሮቶታይፕ — የጸደቁ የምርት መዝገቦች አይደሉም'
        )}
        description={biText(
          locale,
          `All tenant dossiers and leases belong exclusively to ${activeOwner.name}. Lease renewals generate a new version (v+1) and preserve prior versions with status Renewed.`,
          `ሁሉም የተከራይ ማህደሮችና ውሎች የ ${activeOwner.name} ብቻ ናቸው። የውል እድሳት የቀድሞውን እትም ሳያጠፋ አዲስ እትም (v+1) ይፈጥራል።`
        )}
        variant="warning"
        controlType="Prototype Simulation"
        action={
          <button
            type="button"
            disabled={!canCreateLease.allowed || vacantUnits.length === 0}
            title={
              !canCreateLease.allowed
                ? canCreateLease.reason
                : vacantUnits.length === 0
                  ? biText(locale, 'No vacant or reserved units available', 'ክፍት ወይም የተያዘ ክፍል የለም')
                  : biText(locale, 'Launch synthetic lease creation wizard', 'አዲስ ሰው-ሠራሽ ውል መፍጠሪያ ክፈት')
            }
            onClick={openWizard}
            className="px-3.5 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>{biText(locale, 'New Lease Wizard', 'አዲስ የውል አዘጋጅ')}</span>
          </button>
        }
      />

      {/* Section Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-[#152236] rounded-lg">
          <button
            type="button"
            onClick={() => setTab('leases')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              tab === 'leases'
                ? 'bg-white dark:bg-[#0D1D30] text-[#0F233A] dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {biText(locale, 'Leases Registry', 'የውሎች መዝገብ')} ({ownerLeases.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('tenants')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              tab === 'tenants'
                ? 'bg-white dark:bg-[#0D1D30] text-[#0F233A] dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {biText(locale, 'Tenant Directory', 'የተከራዮች ማውጫ')} ({ownerTenants.length})
          </button>
          <button
            type="button"
            data-testid="tab-oromifa-contracts"
            onClick={() => setTab('oromifa-contracts')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              tab === 'oromifa-contracts'
                ? 'bg-white dark:bg-[#0D1D30] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {biText(locale, 'Oromifa Contracts (Waliigaltee)', 'የኦሮምኛ ውሎች (Waliigaltee)')} ({ownerOromifaTemplates.length})
          </button>
        </div>

        {tab === 'leases' && (
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-[#162438] rounded-lg">
            {LEASE_STATUSES.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setLeaseFilter(st)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap shrink-0 ${
                  leaseFilter === st
                    ? 'bg-white dark:bg-[#0D1D30] text-[#0F233A] dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {st === 'All' ? biText(locale, 'All', 'ሁሉም') : trStatus(st)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Leases Table */}
      {tab === 'leases' && (
        <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden">
          {filteredLeases.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title={biText(locale, 'No Synthetic Leases Match Filter', 'ከተመረጠው ማጣሪያ ጋር የሚዛመድ ውል የለም')}
                description={biText(
                  locale,
                  `No leases with status "${leaseFilter}" exist for ${activeOwner.name}.`,
                  `ለ ${activeOwner.name} በዚህ ሁኔታ ላይ ያለ ውል አልተገኘም።`
                )}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Lease & Version', 'ውልና እትም')}</th>
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Unit', 'ክፍል')}</th>
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Tenant', 'ተከራይ')}</th>
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Term', 'የውል ዘመን')}</th>
                    <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Monthly Rent', 'ወርሃዊ ኪራይ')}</th>
                    <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Status', 'ሁኔታ')}</th>
                    <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Action', 'ተግባር')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#233349]/70">
                  {filteredLeases.map((lease) => {
                    const unit = ownerUnits.find((u) => u.id === lease.unitId);
                    const tenant = ownerTenants.find((t) => t.id === lease.tenantId);
                    return (
                      <tr key={lease.id} className="hover:bg-slate-50 dark:hover:bg-[#162438]">
                        <td className="py-3 px-4">
                          <p className="font-mono font-semibold text-[#0F233A] dark:text-[#E5B85C]">
                            {lease.leaseNumber} · v{lease.version}
                          </p>
                          {lease.supersedesLeaseId && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {biText(locale, 'Supersedes prior version', 'የቀድሞውን እትም የተካ')}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">{unit?.name || lease.unitId}</td>
                        <td className="py-3 px-4 text-slate-800 dark:text-slate-200">{tenant?.name || lease.tenantId}</td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {fmtDate(lease.startDate)} → {fmtDate(lease.endDate)}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-right tabular-nums text-slate-900 dark:text-slate-100">
                          {fmtEtb(lease.monthlyRentEtb)}
                        </td>
                        <td className="py-3 px-4">
                          <StatusLabel label={lease.status} />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedLease(lease)}
                            className="text-xs font-semibold text-[#166549] dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            {biText(locale, 'Inspect', 'ዝርዝር ዕይ')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tenant Directory */}
      {tab === 'tenants' && (
        <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Tenant Code', 'የተከራይ ኮድ')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Synthetic Name', 'ሰው-ሠራሽ ስም')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Business Category', 'የሥራ ዘርፍ')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Contact Placeholder', 'የመገኛ ምትክ')}</th>
                  <th className="py-2.5 px-4 font-semibold">{biText(locale, 'Status', 'ሁኔታ')}</th>
                  <th className="py-2.5 px-4 font-semibold text-right">{biText(locale, 'Profile', 'ማህደር')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#233349]/70">
                {ownerTenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-slate-50 dark:hover:bg-[#162438]">
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">{tenant.code}</td>
                    <td className="py-3 px-4 font-semibold text-[#0F233A] dark:text-slate-100">{tenant.name}</td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{tenant.businessType}</td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">{tenant.phonePlaceholder}</td>
                    <td className="py-3 px-4">
                      <StatusLabel label={tenant.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedTenant(tenant)}
                        className="text-xs font-semibold text-[#166549] dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        {biText(locale, 'View Dossier', 'ማህደር ክፈት')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Reusable Oromifa Contract Builder */}
      {tab === 'oromifa-contracts' && <OromifaContractBuilder />}

      {/* Lease Detail Drawer */}
      <SlideDrawer
        open={Boolean(selectedLease)}
        onClose={() => setSelectedLease(null)}
        title={selectedLease ? `${selectedLease.leaseNumber} (v${selectedLease.version})` : ''}
        subtitle={biText(
          locale,
          'Synthetic lease record — non-destructive versioning enabled',
          'ሰው-ሠራሽ የውል መዝገብ — ታሪክን የማያጠፋ የእትም አያያዝ'
        )}
      >
        {selectedLease && (
          <div className="space-y-5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 bg-[#F8FAFC] dark:bg-[#152236]">
              <div>
                <p className="font-semibold text-[#0F233A] dark:text-slate-100">
                  {ownerUnits.find((u) => u.id === selectedLease.unitId)?.name} ·{' '}
                  {ownerTenants.find((t) => t.id === selectedLease.tenantId)?.name}
                </p>
                <p className="text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  {fmtDate(selectedLease.startDate)} → {fmtDate(selectedLease.endDate)} ·{' '}
                  {biText(locale, 'Evidence', 'ማስረጃ')}: {selectedLease.evidenceRef}
                </p>
              </div>
              <StatusLabel label={selectedLease.status} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-3.5 bg-[#F8FAFC] dark:bg-[#152236]">
                <p className="text-slate-500 dark:text-slate-400">{biText(locale, 'Monthly Rent (Synthetic)', 'ወርሃዊ ኪራይ (ሰው-ሠራሽ)')}</p>
                <p className="text-base font-bold font-mono text-[#0F233A] dark:text-[#E5B85C] tabular-nums mt-1">
                  {fmtEtb(selectedLease.monthlyRentEtb)}
                </p>
              </div>
              <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-3.5 bg-[#F8FAFC] dark:bg-[#152236]">
                <p className="text-slate-500 dark:text-slate-400">{biText(locale, 'Security Deposit Placeholder', 'የዋስትና ተቀማጭ ምትክ')}</p>
                <p className="text-base font-bold font-mono text-[#0F233A] dark:text-slate-100 tabular-nums mt-1">
                  {fmtEtb(selectedLease.securityDepositEtb)}
                </p>
              </div>
            </div>

            {selectedLease.oromifaContract && (
              <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-3.5 bg-[#F8FAFC] dark:bg-[#152236] flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-[#0F233A] dark:text-[#E5B85C] inline-flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Waliigaltee Kiraa Mana Daldalaa (Afaan Oromoo)</span>
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                    {selectedLease.oromifaContract.unitRoomLabel} ·{' '}
                    {selectedLease.oromifaContract.advanceMonths} mo advance
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => printOromifaContractDocument(selectedLease.oromifaContract!)}
                    className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#111C2C] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3 h-3" />
                    <span>Print</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const { columns, rows } = buildOromifaContractExportRows(
                        selectedLease.oromifaContract!
                      );
                      downloadExportFile('PDF', {
                        title: `Waliigaltee ${selectedLease.leaseNumber}`,
                        ownerName: activeOwner.name,
                        columns,
                        rows,
                        includeMetadataHeader: false,
                        pdfOrientation: 'portrait',
                      });
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#0F233A] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-[#E5B85C]" />
                    <span>PDF</span>
                  </button>
                </div>
              </div>
            )}

            {(selectedLease.status === 'Active' || selectedLease.status === 'Expiring Soon') && (
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!canRenewLease.allowed}
                  title={canRenewLease.reason}
                  onClick={() => {
                    setRenewTarget(selectedLease);
                    setRenewForm({
                      newStartDate: selectedLease.endDate,
                      newEndDate: '2027-12-31',
                      newMonthlyRentEtb: selectedLease.monthlyRentEtb,
                      evidenceRef: `EVD-RENEW-${selectedLease.version + 1}`,
                      notes: `Non-destructive renewal of ${selectedLease.leaseNumber} v${selectedLease.version}.`,
                    });
                  }}
                  className="px-3.5 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>
                    {biText(
                      locale,
                      `Renew as v${selectedLease.version + 1} (Non-Destructive)`,
                      `እንደ v${selectedLease.version + 1} አድስ (ታሪክ ሳይጠፋ)`
                    )}
                  </span>
                </button>
              </div>
            )}

            {/* Rent Schedule */}
            <div>
              <h3 className="font-semibold text-[#0F233A] dark:text-slate-100 mb-2">
                {biText(locale, 'Synthetic Rent Schedule', 'ሰው-ሠራሽ የኪራይ የጊዜ ሰሌዳ')}
              </h3>
              <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] dark:bg-[#152236] border-b border-[#DFE5EE] dark:border-[#233349] text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2 px-3">{biText(locale, 'Period', 'ወቅት')}</th>
                      <th className="py-2 px-3">{biText(locale, 'Due Date', 'የመክፈያ ቀን')}</th>
                      <th className="py-2 px-3 text-right">{biText(locale, 'Amount', 'መጠን')}</th>
                      <th className="py-2 px-3">{biText(locale, 'Status', 'ሁኔታ')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#233349]/70">
                    {selectedLease.schedule.map((item) => (
                      <tr key={item.period}>
                        <td className="py-2 px-3 font-mono">{item.period}</td>
                        <td className="py-2 px-3 font-mono tabular-nums">{fmtDate(item.dueDate)}</td>
                        <td className="py-2 px-3 font-mono text-right tabular-nums">
                          {fmtEtb(item.amountEtb)}
                        </td>
                        <td className="py-2 px-3">
                          <StatusLabel label={item.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h3 className="font-semibold text-[#0F233A] dark:text-slate-100 mb-2">
                {biText(locale, 'Version & Lifecycle Timeline', 'የእትምና የሕይወት ዑደት ታሪክ')}
              </h3>
              <div className="space-y-2">
                {selectedLease.timeline.map((t, i) => (
                  <div
                    key={i}
                    className="border border-[#DFE5EE] dark:border-[#233349] rounded-lg p-3 bg-[#F8FAFC] dark:bg-[#152236]"
                  >
                    <div className="flex justify-between font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{fmtDate(t.date)}</span>
                      <span>{t.actor}</span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 mt-1">{t.event}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SlideDrawer>

      {/* Tenant Profile Drawer */}
      <SlideDrawer
        open={Boolean(selectedTenant)}
        onClose={() => setSelectedTenant(null)}
        title={selectedTenant?.name || ''}
        subtitle={
          selectedTenant
            ? `${selectedTenant.code} · ${biText(locale, 'Synthetic Tenant Profile', 'ሰው-ሠራሽ የተከራይ መገለጫ')}`
            : undefined
        }
      >
        {selectedTenant && (
          <div className="space-y-5 text-xs">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 bg-[#F8FAFC] dark:bg-[#152236]">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">{biText(locale, 'Business Type', 'የሥራ ዓይነት')}</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{selectedTenant.businessType}</dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">{biText(locale, 'Synthetic ID Placeholder', 'ሰው-ሠራሽ መታወቂያ ምትክ')}</dt>
                <dd className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">{selectedTenant.idPlaceholder}</dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">{biText(locale, 'Phone Placeholder', 'የስልክ ምትክ')}</dt>
                <dd className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">{selectedTenant.phonePlaceholder}</dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">{biText(locale, 'Email Placeholder', 'የኢሜይል ምትክ')}</dt>
                <dd className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">{selectedTenant.emailPlaceholder}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500 dark:text-slate-400">{biText(locale, 'Emergency Contact Placeholder', 'የአደጋ ጊዜ ተጠሪ ምትክ')}</dt>
                <dd className="text-slate-900 dark:text-slate-100 mt-0.5">{selectedTenant.emergencyContactPlaceholder}</dd>
              </div>
            </dl>

            <div>
              <h3 className="font-semibold text-[#0F233A] dark:text-slate-100 mb-2">
                {biText(locale, 'Document Placeholders (No Real Document Storage)', 'የሰነድ ምትኮች (እውነተኛ ፋይል አይከማችም)')}
              </h3>
              <div className="space-y-2">
                {selectedTenant.documentPlaceholders.map((doc) => (
                  <div
                    key={doc.id}
                    className="border border-[#DFE5EE] dark:border-[#233349] rounded-lg p-3 flex items-center justify-between gap-3 bg-white dark:bg-[#162438]"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{doc.label}</p>
                      <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{doc.refCode}</p>
                    </div>
                    <StatusLabel label={doc.status} tone="slate" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SlideDrawer>

      {/* Lease Creation Wizard Modal */}
      <Modal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title={biText(
          locale,
          `Synthetic Lease Creation Wizard (Step ${wizardStep} of 2)`,
          `ሰው-ሠራሽ የውል መፍጠሪያ (ደረጃ ${wizardStep} ከ 2)`
        )}
        subtitle={biText(
          locale,
          'Prototype simulation only — creates synthetic lease and initial monthly charge.',
          'የፕሮቶታይፕ ማስመሰያ ብቻ — ሰው-ሠራሽ ውልና የመጀመሪያ ወር ክፍያ ይፈጥራል።'
        )}
      >
        <form onSubmit={handleWizardSubmit} className="space-y-4 text-xs">
          {wizardError && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-200">
              {wizardError}
            </div>
          )}

          {wizardStep === 1 ? (
            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                  {biText(locale, 'Available Unit *', 'ክፍት ክፍል *')}
                </label>
                <select
                  value={wizardForm.unitId}
                  onChange={(e) => {
                    const u = ownerUnits.find((x) => x.id === e.target.value);
                    setWizardForm({
                      ...wizardForm,
                      unitId: e.target.value,
                      monthlyRentEtb: u?.baseRentEtb || wizardForm.monthlyRentEtb,
                      securityDepositEtb: (u?.baseRentEtb || wizardForm.monthlyRentEtb) * 2,
                    });
                  }}
                  className={inputCls}
                >
                  {vacantUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({trStatus(u.status)} · {fmtEtb(u.baseRentEtb)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                  {biText(locale, 'Synthetic Tenant *', 'ሰው-ሠራሽ ተከራይ *')}
                </label>
                <select
                  value={wizardForm.tenantId}
                  onChange={(e) => setWizardForm({ ...wizardForm, tenantId: e.target.value })}
                  className={inputCls}
                >
                  {ownerTenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                    {biText(locale, 'Start Date *', 'የመጀመሪያ ቀን *')}
                  </label>
                  <input
                    type="date"
                    value={wizardForm.startDate}
                    onChange={(e) => setWizardForm({ ...wizardForm, startDate: e.target.value })}
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                    {biText(locale, 'End Date *', 'የመጨረሻ ቀን *')}
                  </label>
                  <input
                    type="date"
                    value={wizardForm.endDate}
                    onChange={(e) => setWizardForm({ ...wizardForm, endDate: e.target.value })}
                    className={`${inputCls} font-mono`}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {biText(locale, 'Term preset:', 'የጊዜ አማራጭ:')}
                </span>
                {[
                  { label: '6 Months', months: 6 },
                  { label: '1 Year', months: 12 },
                  { label: '2 Years', months: 24 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      const base = new Date(wizardForm.startDate || '2026-12-01');
                      if (!Number.isNaN(base.getTime())) {
                        base.setMonth(base.getMonth() + preset.months);
                        base.setDate(base.getDate() - 1);
                        setWizardForm({
                          ...wizardForm,
                          endDate: base.toISOString().slice(0, 10),
                        });
                      }
                    }}
                    className="px-2 py-1 rounded bg-slate-100 dark:bg-[#152236] hover:bg-slate-200 dark:hover:bg-[#1D2E48] text-[11px] font-medium cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWizardOpen(false)}
                  className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] text-slate-700 dark:text-slate-200"
                >
                  {labels.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleWizardNext}
                  className="px-4 py-2 rounded-lg bg-[#0F233A] dark:bg-[#166549] text-white font-semibold"
                >
                  {biText(locale, 'Next: Financial Terms', 'ቀጣይ፡ የገንዘብ ውሎች')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                  {biText(
                    locale,
                    'Contract Template Attachment',
                    'የውል አብነት አባሪ (Waliigaltee)'
                  )}
                </label>
                <select
                  value={wizardForm.contractTemplateId}
                  onChange={(e) =>
                    setWizardForm({ ...wizardForm, contractTemplateId: e.target.value })
                  }
                  className={inputCls}
                >
                  <option value="">
                    {biText(locale, 'Standard Lease Summary Only', 'መደበኛ የውል ማጠቃለያ ብቻ')}
                  </option>
                  {ownerOromifaTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      Afaan Oromoo: {tpl.templateName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                    {biText(locale, 'Monthly Rent (ETB) *', 'ወርሃዊ ኪራይ (ብር) *')}
                  </label>
                  <input
                    type="number"
                    min={1000}
                    value={wizardForm.monthlyRentEtb}
                    onChange={(e) =>
                      setWizardForm({ ...wizardForm, monthlyRentEtb: Number(e.target.value) })
                    }
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                    {biText(locale, 'Security Deposit (ETB)', 'የዋስትና ተቀማጭ (ብር)')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={wizardForm.securityDepositEtb}
                    onChange={(e) =>
                      setWizardForm({ ...wizardForm, securityDepositEtb: Number(e.target.value) })
                    }
                    className={`${inputCls} font-mono`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 items-center">
                <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wizardForm.includeVat15}
                    onChange={(e) =>
                      setWizardForm({ ...wizardForm, includeVat15: e.target.checked })
                    }
                    className="rounded border-slate-300 text-[#166549] focus:ring-[#166549]"
                  />
                  <span>{biText(locale, 'Include 15% T.D.Q (VAT) in contract', '15% VAT በውሉ ላይ አካትት')}</span>
                </label>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                    {biText(locale, 'Advance Months', 'የቅድሚያ ክፍያ ወራት')}
                  </label>
                  <select
                    value={wizardForm.advanceMonths}
                    onChange={(e) =>
                      setWizardForm({ ...wizardForm, advanceMonths: Number(e.target.value) })
                    }
                    className={inputCls}
                  >
                    {[1, 3, 6, 12].map((m) => (
                      <option key={m} value={m}>
                        {m} month(s)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                  {biText(locale, 'Evidence Reference *', 'የማስረጃ ማጣቀሻ *')}
                </label>
                <input
                  required
                  value={wizardForm.evidenceRef}
                  onChange={(e) => setWizardForm({ ...wizardForm, evidenceRef: e.target.value })}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                  {biText(locale, 'Lease Notes', 'የውል ማስታወሻ')}
                </label>
                <textarea
                  rows={2}
                  value={wizardForm.notes}
                  onChange={(e) => setWizardForm({ ...wizardForm, notes: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="pt-2 flex justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] text-slate-700 dark:text-slate-200"
                >
                  {biText(locale, 'Back', 'ተመለስ')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold"
                >
                  {biText(locale, 'Activate Synthetic Lease', 'ሰው-ሠራሽ ውል አንቃ')}
                </button>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Non-Destructive Lease Renewal Modal */}
      <Modal
        open={Boolean(renewTarget)}
        onClose={() => setRenewTarget(null)}
        title={
          renewTarget
            ? biText(
                locale,
                `Renew ${renewTarget.leaseNumber} as v${renewTarget.version + 1}`,
                `${renewTarget.leaseNumber}ን እንደ v${renewTarget.version + 1} አድስ`
              )
            : ''
        }
        subtitle={biText(
          locale,
          'Preserves prior version as Renewed instead of overwriting historical terms.',
          'ያለፈውን እትም ከማጥፋት ይልቅ እንደ "Renewed" አስቀምጦ አዲስ እትም ይፈጥራል።'
        )}
      >
        {renewTarget && (
          <form onSubmit={handleRenewSubmit} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                  {biText(locale, 'New Start Date *', 'አዲስ መጀመሪያ ቀን *')}
                </label>
                <input
                  type="date"
                  required
                  value={renewForm.newStartDate}
                  onChange={(e) => setRenewForm({ ...renewForm, newStartDate: e.target.value })}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                  {biText(locale, 'New End Date *', 'አዲስ መጨረሻ ቀን *')}
                </label>
                <input
                  type="date"
                  required
                  value={renewForm.newEndDate}
                  onChange={(e) => setRenewForm({ ...renewForm, newEndDate: e.target.value })}
                  className={`${inputCls} font-mono`}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                  {biText(locale, 'Updated Monthly Rent (ETB) *', 'የታደሰ ወርሃዊ ኪራይ (ብር) *')}
                </label>
                <input
                  type="number"
                  required
                  min={1000}
                  value={renewForm.newMonthlyRentEtb}
                  onChange={(e) =>
                    setRenewForm({ ...renewForm, newMonthlyRentEtb: Number(e.target.value) })
                  }
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                  {biText(locale, 'Evidence Ref *', 'የማስረጃ ማጣቀሻ *')}
                </label>
                <input
                  required
                  value={renewForm.evidenceRef}
                  onChange={(e) => setRenewForm({ ...renewForm, evidenceRef: e.target.value })}
                  className={`${inputCls} font-mono`}
                />
              </div>
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenewTarget(null)}
                className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] text-slate-700 dark:text-slate-200"
              >
                {labels.cancel}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold"
              >
                {biText(locale, `Create Version v${renewTarget.version + 1}`, `እትም v${renewTarget.version + 1} ፍጠር`)}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
