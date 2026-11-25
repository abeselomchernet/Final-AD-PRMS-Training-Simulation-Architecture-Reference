import React, { useMemo, useState } from 'react';
import {
  BookmarkPlus,
  Calculator,
  CheckCircle2,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Printer,
  RotateCcw,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { usePrms } from '../../context/PrmsContext';
import { biText } from '../../data/i18n';
import {
  buildOromifaContractExportRows,
  buildOromifaContractSections,
  createSampleOromifaContractData,
  OROMIFA_CONTRACT_IMAGES,
  printOromifaContractDocument,
  recalculateOromifaFinancials,
} from '../../data/oromifaContractTemplate';
import { checkActionPermission } from '../../policies/rbac';
import { OromifaContractData } from '../../types/prms';
import { downloadExportFile } from '../../utils/exportDownload';

type InputSectionTab = 'parties' | 'property' | 'financial' | 'witnesses';

export const OromifaContractBuilder: React.FC = () => {
  const {
    activeOwner,
    currentPersona,
    ownerUnits,
    ownerTenants,
    ownerOromifaTemplates,
    saveOromifaTemplate,
    deleteOromifaTemplate,
    createLease,
    notify,
    locale,
    fmtEtb,
  } = usePrms();

  const canCreateLease = checkActionPermission(currentPersona.role, 'create_lease');
  const vacantOrReservedUnits = useMemo(
    () => ownerUnits.filter((u) => u.status === 'Vacant' || u.status === 'Reserved'),
    [ownerUnits]
  );

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    ownerOromifaTemplates[0]?.id || ''
  );
  const [contractData, setContractData] = useState<OromifaContractData>(
    () => ownerOromifaTemplates[0]?.data || createSampleOromifaContractData()
  );
  const [inputTab, setInputTab] = useState<InputSectionTab>('parties');
  const [previewView, setPreviewView] = useState<'document' | 'scans'>('document');
  const [activeScanPage, setActiveScanPage] = useState<number>(1);

  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    vacantOrReservedUnits[0]?.id || ownerUnits[0]?.id || ''
  );
  const [selectedTenantId, setSelectedTenantId] = useState<string>(
    ownerTenants[0]?.id || ''
  );
  const [leaseStartIso, setLeaseStartIso] = useState('2026-12-01');
  const [leaseEndIso, setLeaseEndIso] = useState('2027-11-30');

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [templateDescDraft, setTemplateDescDraft] = useState('');

  const computedData = contractData;
  const documentSections = useMemo(
    () => buildOromifaContractSections(computedData),
    [computedData]
  );

  const updateField = <K extends keyof OromifaContractData>(
    key: K,
    value: OromifaContractData[K]
  ) => {
    setContractData((prev) => {
      const next = { ...prev, [key]: value };
      if (
        key === 'baseMonthlyRentEtb' ||
        key === 'vatRatePercent' ||
        key === 'advanceMonths'
      ) {
        return recalculateOromifaFinancials(next);
      }
      return next;
    });
  };

  const handleLoadTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const found = ownerOromifaTemplates.find((t) => t.id === tplId);
    if (found) {
      setContractData(found.data);
    }
  };

  const handlePopulateFromPortfolio = () => {
    const unit = ownerUnits.find((u) => u.id === selectedUnitId);
    const tenant = ownerTenants.find((t) => t.id === selectedTenantId);
    setContractData((prev) => {
      const next: OromifaContractData = {
        ...prev,
        landlordTitleAndName: activeOwner.name,
        landlordAddress: activeOwner.addressPlaceholder,
        landlordPhone: activeOwner.contactPlaceholder,
        landlordTin: activeOwner.tinPlaceholder,
        landlordVat: activeOwner.vatRegPlaceholder,
        signatureLandlordName: activeOwner.name,
        ...(tenant
          ? {
              tenantTitleAndName: tenant.name,
              tenantPhone: tenant.phonePlaceholder,
              tenantTin: tenant.idPlaceholder,
              businessPurpose: `Tajajila Daldalaa (${tenant.businessType})`,
              signatureTenantName: tenant.name,
            }
          : {}),
        ...(unit
          ? {
              unitRoomLabel: `${unit.code} — ${unit.name} (Fooqii ${unit.floor})`,
              baseMonthlyRentEtb: unit.baseRentEtb,
            }
          : {}),
      };
      return recalculateOromifaFinancials(next);
    });
    notify({
      tone: 'info',
      title: biText(locale, 'Contract Fields Populated', 'Odeeffannoon Waliigaltee Guutameera'),
      detail: biText(
        locale,
        'Synced Owner, Unit, and Tenant details into the Oromifa template.',
        'Owner, unit, and tenant details merged into the Afaan Oromoo contract.'
      ),
    });
  };

  const handleResetToExactSample = () => {
    setContractData(createSampleOromifaContractData());
    notify({
      tone: 'info',
      title: biText(locale, 'Reset to Exact Oromifa Sample', 'Waliigaltee Oromiffaa Jalqabaatti Deebi’e'),
      detail: biText(
        locale,
        'Restored verbatim Afaan Oromoo clauses and sample figures.',
        'Verbatim Oromifa template values restored.'
      ),
    });
  };

  const handleSaveReusableTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateNameDraft.trim()) return;
    const saved = saveOromifaTemplate({
      templateName: templateNameDraft,
      description:
        templateDescDraft ||
        `Reusable Afaan Oromoo contract (${computedData.businessPurpose})`,
      data: computedData,
    });
    setSelectedTemplateId(saved.id);
    setSaveModalOpen(false);
    setTemplateNameDraft('');
    setTemplateDescDraft('');
  };

  const handleDownload = (format: 'PDF' | 'Excel') => {
    const { columns, rows } = buildOromifaContractExportRows(computedData);
    const result = downloadExportFile(format, {
      title: `Waliigaltee Kiraa Mana Daldalaa - ${computedData.tenantTitleAndName}`,
      ownerName: activeOwner.name,
      columns,
      rows,
      includeMetadataHeader: false,
      pdfOrientation: 'portrait',
    });
    notify({
      tone: 'success',
      title: biText(locale, `Oromifa Contract ${format} Ready`, `Waliigalteen ${format} Buufameera`),
      detail: `${result.filename} downloaded.`,
    });
  };

  const handleCreateLeaseFromContract = () => {
    if (!selectedUnitId || !selectedTenantId) return;
    createLease({
      unitId: selectedUnitId,
      tenantId: selectedTenantId,
      startDate: leaseStartIso,
      endDate: leaseEndIso,
      monthlyRentEtb: computedData.grossMonthlyRentEtb,
      securityDepositEtb: computedData.utilityDepositEtb + computedData.grossMonthlyRentEtb,
      evidenceRef: `EVD-WAL-${computedData.parcelUniqueNo}`,
      notes: `Waliigaltee Kiraa Mana Daldalaa (Oromifa) · ${computedData.startDateEc} → ${computedData.endDateEc}`,
      contractLanguage: 'om',
      oromifaContract: computedData,
    });
  };

  const inputCls =
    'w-full px-3 py-2 bg-white dark:bg-[#162438] border border-[#CBD5E1] dark:border-[#2D405B] rounded-lg text-xs text-[#0F1D2F] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#166549]';

  const activeScan =
    OROMIFA_CONTRACT_IMAGES.find((img) => img.page === activeScanPage) ||
    OROMIFA_CONTRACT_IMAGES[0];

  return (
    <div className="space-y-4" data-testid="oromifa-contract-builder">
      {/* Reusable Template & Portfolio Sync Toolbar */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
              {biText(
                locale,
                'Waliigaltee Kiraa Mana Daldalaa — Reusable Oromifa Contract Builder',
                'የኦሮምኛ (Afaan Oromoo) የንግድ ቤት ኪራይ ውል ማዘጋጃ'
              )}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {biText(
                locale,
                'Uses the exact attached Afaan Oromoo legal clauses (Keewwata 1–8) with sectioned quick-fill inputs for repeat contracts.',
                'ከተያያዘው የኦሮምኛ ውል ናሙና (Keewwata 1–8) ጋር ሙሉ በሙሉ የሚዛመድና በተደጋጋሚ የሚሞላ የውል ቅጽ።'
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleResetToExactSample}
              className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1D2E48] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{biText(locale, 'Load Original Sample', 'ናሙናውን ጫን')}</span>
            </button>
            <button
              type="button"
              data-testid="open-save-oromifa-template-btn"
              onClick={() => {
                setTemplateNameDraft(
                  `Waliigaltee — ${computedData.unitRoomLabel.slice(0, 26)}`
                );
                setTemplateDescDraft(computedData.businessPurpose);
                setSaveModalOpen(true);
              }}
              className="px-3 py-2 rounded-lg bg-[#0F233A] hover:bg-[#173252] dark:bg-[#1A314E] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-[#E5B85C]" />
              <span>{biText(locale, 'Save Reusable Template', 'እንደ ቋሚ አብነት አስቀምጥ')}</span>
            </button>
          </div>
        </div>

        {/* Saved Template Selector + Quick Portfolio Sync */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-[#DFE5EE] dark:border-[#233349]">
          <div className="md:col-span-4">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
              {biText(locale, 'Saved Oromifa Templates', 'የተቀመጡ የኦሮምኛ ውል አብነቶች')}
            </label>
            <div className="flex items-center gap-1.5">
              <select
                aria-label="Saved Oromifa Templates"
                value={selectedTemplateId}
                onChange={(e) => handleLoadTemplate(e.target.value)}
                className={inputCls}
              >
                {ownerOromifaTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.templateName}
                  </option>
                ))}
              </select>
              {ownerOromifaTemplates.length > 1 &&
                !selectedTemplateId.startsWith('TPL-OM-SAMPLE-') && (
                  <button
                    type="button"
                    aria-label="Delete selected template"
                    onClick={() => {
                      deleteOromifaTemplate(selectedTemplateId);
                      const fallback = ownerOromifaTemplates.find(
                        (t) => t.id !== selectedTemplateId
                      );
                      if (fallback) handleLoadTemplate(fallback.id);
                    }}
                    className="p-2 rounded-lg border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
              {biText(locale, 'Portfolio Unit', 'ክፍል')}
            </label>
            <select
              aria-label="Portfolio Unit"
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className={inputCls}
            >
              {ownerUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} — {u.name} ({u.status})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
              {biText(locale, 'Tenant Record', 'ተከራይ')}
            </label>
            <select
              aria-label="Tenant Record"
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className={inputCls}
            >
              {ownerTenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              type="button"
              data-testid="populate-from-portfolio-btn"
              onClick={handlePopulateFromPortfolio}
              className="w-full py-2 px-3 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              <span>{biText(locale, 'Auto-Fill', 'ራስ-ሙላ')}</span>
            </button>
          </div>
        </div>

        {saveModalOpen && (
          <form
            onSubmit={handleSaveReusableTemplate}
            className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#152236] border border-[#CBD5E1] dark:border-[#2D405B] grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end"
          >
            <div className="md:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                {biText(locale, 'Template Name *', 'የአብነት ስም *')}
              </label>
              <input
                required
                value={templateNameDraft}
                onChange={(e) => setTemplateNameDraft(e.target.value)}
                placeholder="e.g. Adaamaa Retail Ground Standard"
                className={inputCls}
              />
            </div>
            <div className="md:col-span-5">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                {biText(locale, 'Template Note', 'መግለጫ')}
              </label>
              <input
                value={templateDescDraft}
                onChange={(e) => setTemplateDescDraft(e.target.value)}
                placeholder="Commercial shop lease with 3-month advance"
                className={inputCls}
              />
            </div>
            <div className="md:col-span-3 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {biText(locale, 'Cancel', 'ሰርዝ')}
              </button>
              <button
                type="submit"
                data-testid="confirm-save-oromifa-template-btn"
                className="px-3.5 py-2 rounded-lg bg-[#166549] text-white text-xs font-semibold cursor-pointer"
              >
                {biText(locale, 'Save', 'አስቀምጥ')}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Split Workspace: Sectioned Input Form (Left) + Exact Oromifa Document Preview (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Left Column: Sectioned Input Methods */}
        <section className="xl:col-span-5 bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden">
          <div className="p-2 bg-[#F8FAFC] dark:bg-[#152236] border-b border-[#DFE5EE] dark:border-[#233349] grid grid-cols-2 sm:grid-cols-4 gap-1">
            {(
              [
                { id: 'parties', label: '1. Parties (TIN)' },
                { id: 'property', label: '2. Unit & Term' },
                { id: 'financial', label: '3. Rent & VAT' },
                { id: 'witnesses', label: '4. Witnesses' },
              ] as { id: InputSectionTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setInputTab(t.id)}
                className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  inputTab === t.id
                    ? 'bg-white dark:bg-[#0D1D30] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-3 text-xs">
            {inputTab === 'parties' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                      Guyyaa Waliigaltee (E.C.)
                    </label>
                    <input
                      value={contractData.contractDateEc}
                      onChange={(e) => updateField('contractDateEc', e.target.value)}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                      Lakk. Hayyama Daldalaa (Tenant)
                    </label>
                    <input
                      value={contractData.tenantTradeLicense}
                      onChange={(e) => updateField('tenantTradeLicense', e.target.value)}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-[#233349] space-y-2.5">
                  <p className="font-bold text-[#0F233A] dark:text-[#E5B85C]">
                    Ahadii Kennaan (Kireessaan / Landlord)
                  </p>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                      Maqaa Kireessaa
                    </label>
                    <input
                      value={contractData.landlordTitleAndName}
                      onChange={(e) => updateField('landlordTitleAndName', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                      Teessoon Kireessaa
                    </label>
                    <input
                      value={contractData.landlordAddress}
                      onChange={(e) => updateField('landlordAddress', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                        Bilbila
                      </label>
                      <input
                        value={contractData.landlordPhone}
                        onChange={(e) => updateField('landlordPhone', e.target.value)}
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                        TIN
                      </label>
                      <input
                        value={contractData.landlordTin}
                        onChange={(e) => updateField('landlordTin', e.target.value)}
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                        T.D.Q (VAT)
                      </label>
                      <input
                        value={contractData.landlordVat}
                        onChange={(e) => updateField('landlordVat', e.target.value)}
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-[#233349] space-y-2.5">
                  <p className="font-bold text-[#0F233A] dark:text-[#E5B85C]">
                    Ahadii Fudhataan (Kireeffataan / Tenant)
                  </p>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                      Maqaa Kireeffataa
                    </label>
                    <input
                      value={contractData.tenantTitleAndName}
                      onChange={(e) => updateField('tenantTitleAndName', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                      Teessoon Kireeffataa
                    </label>
                    <input
                      value={contractData.tenantAddress}
                      onChange={(e) => updateField('tenantAddress', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                        Bilbila
                      </label>
                      <input
                        value={contractData.tenantPhone}
                        onChange={(e) => updateField('tenantPhone', e.target.value)}
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                        TIN
                      </label>
                      <input
                        value={contractData.tenantTin}
                        onChange={(e) => updateField('tenantTin', e.target.value)}
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                        T.D.Q (VAT)
                      </label>
                      <input
                        value={contractData.tenantVat}
                        onChange={(e) => updateField('tenantVat', e.target.value)}
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {inputTab === 'property' && (
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                    Teessoo Mana Daldalaa (Keewwata 2)
                  </label>
                  <input
                    value={contractData.propertyLocation}
                    onChange={(e) => updateField('propertyLocation', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                      Lakk. Addaa Cituu Laffaa
                    </label>
                    <input
                      value={contractData.parcelUniqueNo}
                      onChange={(e) => updateField('parcelUniqueNo', e.target.value)}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                      Guyyaa Galmee (E.C.)
                    </label>
                    <input
                      value={contractData.registrationDateEc}
                      onChange={(e) => updateField('registrationDateEc', e.target.value)}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                    Kutaa / Lakk. Manaa
                  </label>
                  <input
                    value={contractData.unitRoomLabel}
                    onChange={(e) => updateField('unitRoomLabel', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                    Kaayyoo / Gosa Daldalaa
                  </label>
                  <input
                    value={contractData.businessPurpose}
                    onChange={(e) => updateField('businessPurpose', e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-[#233349] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#0F233A] dark:text-[#E5B85C]">
                      Bara Waliigaltee (Keewwata 3)
                    </span>
                    <div className="flex items-center gap-1">
                      {[
                        { label: 'Waggaa 1', text: 'waggaa 1(Tokkoo)' },
                        { label: "Ji'a 6", text: "ji'a 6(Ja'a)" },
                        { label: 'Waggaa 2', text: 'waggaa 2(Lama)' },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => updateField('durationText', preset.text)}
                          className="px-2 py-1 rounded bg-slate-100 dark:bg-[#152236] hover:bg-slate-200 dark:hover:bg-[#1D2E48] text-[11px] font-medium cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                        Guyyaa Jalqabaa
                      </label>
                      <input
                        value={contractData.startDateEc}
                        onChange={(e) => updateField('startDateEc', e.target.value)}
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                        Guyyaa Dhumaa
                      </label>
                      <input
                        value={contractData.endDateEc}
                        onChange={(e) => updateField('endDateEc', e.target.value)}
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                        Turtii
                      </label>
                      <input
                        value={contractData.durationText}
                        onChange={(e) => updateField('durationText', e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                      Kaffaltii Dursaa (Ji’oota)
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 3, 6, 12].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => updateField('advanceMonths', m)}
                          className={`py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                            contractData.advanceMonths === m
                              ? 'bg-[#166549] border-[#166549] text-white'
                              : 'bg-white dark:bg-[#162438] border-[#CBD5E1] dark:border-[#2D405B] text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          Ji’a {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {inputTab === 'financial' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0F233A] dark:text-[#E5B85C] inline-flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5" />
                      Gatii Kiraa &amp; T.D.Q (VAT) Calculator
                    </span>
                    <div className="flex items-center gap-1">
                      {[15, 0].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => updateField('vatRatePercent', rate)}
                          className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                            contractData.vatRatePercent === rate
                              ? 'bg-[#0F233A] text-white dark:bg-[#166549]'
                              : 'bg-white dark:bg-[#111C2C] text-slate-600 dark:text-slate-300 border border-[#CBD5E1] dark:border-[#2D405B]'
                          }`}
                        >
                          VAT {rate}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                        Kiraa Bu’uraa Ji’aa (Base Qr.)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={contractData.baseMonthlyRentEtb}
                        onChange={(e) =>
                          updateField('baseMonthlyRentEtb', Number(e.target.value))
                        }
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                        T.D.Q (VAT %)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.5"
                        value={contractData.vatRatePercent}
                        onChange={(e) =>
                          updateField('vatRatePercent', Number(e.target.value))
                        }
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                    <div className="p-2 rounded-lg bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349]">
                      <p className="text-slate-500 dark:text-slate-400">VAT Ji’aa</p>
                      <p className="font-mono font-bold text-[#0F233A] dark:text-slate-100">
                        {fmtEtb(computedData.vatAmountEtb)}
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349]">
                      <p className="text-slate-500 dark:text-slate-400">Waliigala Ji’aa</p>
                      <p className="font-mono font-bold text-[#166549] dark:text-emerald-400">
                        {fmtEtb(computedData.grossMonthlyRentEtb)}
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349]">
                      <p className="text-slate-500 dark:text-slate-400">
                        Dursa Ji’a {computedData.advanceMonths}
                      </p>
                      <p className="font-mono font-bold text-[#0F233A] dark:text-[#E5B85C]">
                        {fmtEtb(computedData.advanceGrandTotalEtb)}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                    Maallaqa Dursaa Jechootaan (Afaan Oromoo)
                  </label>
                  <input
                    value={contractData.advanceGrandTotalWordsOm}
                    onChange={(e) =>
                      updateField('advanceGrandTotalWordsOm', e.target.value)
                    }
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                      Maqaa Bankii
                    </label>
                    <input
                      value={contractData.bankName}
                      onChange={(e) => updateField('bankName', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                      Lakk. Herrega Bankii
                    </label>
                    <input
                      value={contractData.bankAccountNumber}
                      onChange={(e) => updateField('bankAccountNumber', e.target.value)}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                      Adabbii Guyyaa %
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={contractData.dailyPenaltyPercent}
                      onChange={(e) =>
                        updateField('dailyPenaltyPercent', Number(e.target.value))
                      }
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                      Ibsaa/Bishaan (7.2)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={contractData.utilityDepositEtb}
                      onChange={(e) =>
                        updateField('utilityDepositEtb', Number(e.target.value))
                      }
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                      Adabbii Diiggaa (7.5)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={contractData.breachPenaltyEtb}
                      onChange={(e) =>
                        updateField('breachPenaltyEtb', Number(e.target.value))
                      }
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                </div>
              </div>
            )}

            {inputTab === 'witnesses' && (
              <div className="space-y-3">
                <p className="font-bold text-[#0F233A] dark:text-[#E5B85C]">
                  KEEWWATA-8 · Ragaalee Namaa (3 Witnesses)
                </p>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                    1. Ragaa 1ffaa (Maqaa fi Teessoo)
                  </label>
                  <input
                    value={contractData.witness1}
                    onChange={(e) => updateField('witness1', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                    2. Ragaa 2ffaa (Maqaa fi Teessoo)
                  </label>
                  <input
                    value={contractData.witness2}
                    onChange={(e) => updateField('witness2', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                    3. Ragaa 3ffaa (Maqaa fi Teessoo)
                  </label>
                  <input
                    value={contractData.witness3}
                    onChange={(e) => updateField('witness3', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 dark:border-[#233349]">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                      Mallattoo Kireessaa (Maqaa)
                    </label>
                    <input
                      value={contractData.signatureLandlordName}
                      onChange={(e) => updateField('signatureLandlordName', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                      Mallattoo Kireeffataa (Maqaa)
                    </label>
                    <input
                      value={contractData.signatureTenantName}
                      onChange={(e) => updateField('signatureTenantName', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Quick Create Lease From Oromifa Contract Bar */}
            <div className="pt-3 mt-2 border-t border-[#DFE5EE] dark:border-[#233349] space-y-2.5">
              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                {biText(
                  locale,
                  'Create Lease Record with Attached Oromifa Contract',
                  'በዚህ የኦሮምኛ ውል አዲስ የኪራይ ውል መዝገብ ፍጠር'
                )}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  aria-label="Lease Start Date (Gregorian)"
                  value={leaseStartIso}
                  onChange={(e) => setLeaseStartIso(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
                <input
                  type="date"
                  aria-label="Lease End Date (Gregorian)"
                  value={leaseEndIso}
                  onChange={(e) => setLeaseEndIso(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <button
                type="button"
                data-testid="activate-lease-from-oromifa-btn"
                disabled={!canCreateLease.allowed || !selectedUnitId || !selectedTenantId}
                title={canCreateLease.reason}
                onClick={handleCreateLeaseFromContract}
                className="w-full py-2.5 px-4 rounded-lg bg-[#166549] hover:bg-[#12533B] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>
                  {biText(
                    locale,
                    'Activate Lease from Oromifa Contract',
                    'ከኦሮምኛ ውል የኪራይ መዝገብ አንቃ'
                  )}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Right Column: Live Verbatim Oromifa Document Preview + Sample Scans */}
        <section className="xl:col-span-7 bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-[#F8FAFC] dark:bg-[#152236] border-b border-[#DFE5EE] dark:border-[#233349] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-[#0D1D30] rounded-lg">
              <button
                type="button"
                onClick={() => setPreviewView('document')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                  previewView === 'document'
                    ? 'bg-white dark:bg-[#162438] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Waliigaltee (Afaan Oromoo)</span>
              </button>
              <button
                type="button"
                data-testid="oromifa-view-scans-btn"
                onClick={() => setPreviewView('scans')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                  previewView === 'scans'
                    ? 'bg-white dark:bg-[#162438] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Attached Sample Scans (5)</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                data-testid="oromifa-print-btn"
                onClick={() => printOromifaContractDocument(computedData)}
                className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#162438] text-xs font-semibold text-[#0F233A] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#1D2E48] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                type="button"
                data-testid="oromifa-download-pdf-btn"
                onClick={() => handleDownload('PDF')}
                className="px-3 py-1.5 rounded-lg bg-[#0F233A] hover:bg-[#173252] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#E5B85C]" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                data-testid="oromifa-download-excel-btn"
                onClick={() => handleDownload('Excel')}
                className="px-3 py-1.5 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
            </div>
          </div>

          {previewView === 'document' ? (
            <div
              data-testid="oromifa-contract-document-preview"
              className="p-5 sm:p-7 max-h-[680px] overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-900 dark:text-slate-100"
            >
              <p className="text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                {documentSections.dateLine}
              </p>
              <h3 className="text-center text-sm font-bold underline tracking-wide text-[#0F233A] dark:text-[#E5B85C]">
                {documentSections.title}
              </h3>

              <div className="space-y-1.5 bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE] dark:border-[#233349] rounded-lg p-3.5">
                {documentSections.partiesLines.map((line, idx) => (
                  <p key={idx}>
                    <strong className="text-[#0F233A] dark:text-slate-100">
                      {line.label}
                    </strong>{' '}
                    <span className="text-slate-800 dark:text-slate-200">{line.value}</span>
                  </p>
                ))}
              </div>

              <p className="italic text-slate-700 dark:text-slate-300">
                {documentSections.legalPreamble}
              </p>

              {documentSections.articles.map((art) => (
                <div key={art.heading} className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-center gap-3 font-bold text-[#0F233A] dark:text-[#E5B85C]">
                    <span className="underline">{art.heading}</span>
                    {art.subheading && <span>{art.subheading}</span>}
                  </div>
                  {art.paragraphs.map((p, idx) => (
                    <p key={idx} className="text-slate-800 dark:text-slate-200">
                      {p}
                    </p>
                  ))}
                </div>
              ))}

              <ol className="list-decimal pl-5 space-y-1 text-slate-800 dark:text-slate-200">
                {documentSections.witnesses.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ol>

              <p className="text-slate-800 dark:text-slate-200">
                {documentSections.witnessAttestation}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#DFE5EE] dark:border-[#233349]">
                <div className="space-y-1">
                  <p className="font-bold underline">Maqaa fi Mallattoo Kireessaa</p>
                  <p>Maqaa: {computedData.signatureLandlordName}</p>
                  <p className="font-mono text-slate-500 dark:text-slate-400">
                    Mallattoo: ____________ Guyyaa: ________
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-bold underline">Maqaa fi Mallattoo Kireeffataa</p>
                  <p>Maqaa: {computedData.signatureTenantName}</p>
                  <p className="font-mono text-slate-500 dark:text-slate-400">
                    Mallattoo: ____________ Guyyaa: ________
                  </p>
                </div>
              </div>

              <div className="pt-2 text-center text-[11px] text-slate-600 dark:text-slate-400">
                <p className="font-bold">Mallattoo Ragoottaa</p>
                <p className="font-mono mt-1">
                  1. ________________ &nbsp;&nbsp; 2. ________________ &nbsp;&nbsp; 3. ________________
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-3" data-testid="oromifa-sample-scans-viewer">
              <div className="flex flex-wrap items-center gap-1.5">
                {OROMIFA_CONTRACT_IMAGES.map((img) => (
                  <button
                    key={img.page}
                    type="button"
                    onClick={() => setActiveScanPage(img.page)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      activeScanPage === img.page
                        ? 'bg-[#0F233A] text-white dark:bg-[#166549]'
                        : 'bg-slate-100 dark:bg-[#152236] text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {img.label}
                  </button>
                ))}
              </div>
              <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden bg-slate-100 dark:bg-[#0B131E]">
                <img
                  src={activeScan.src}
                  alt={activeScan.label}
                  className="w-full max-h-[560px] object-contain mx-auto"
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  Original attached Afaan Oromoo rental agreement reference page ({activeScan.label}).
                </span>
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
