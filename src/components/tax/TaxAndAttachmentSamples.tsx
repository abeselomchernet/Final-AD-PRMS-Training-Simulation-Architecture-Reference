import React, { useMemo, useState } from 'react';
import {
  CheckSquare,
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  ReceiptText,
  RotateCcw,
  UserCheck,
} from 'lucide-react';
import { usePrms } from '../../context/PrmsContext';
import { biText } from '../../data/i18n';
import {
  CASH_ATTACHMENT_SAMPLE_IMAGE,
  TAX_FORM_SAMPLE_IMAGE,
} from '../../data/oromifaContractTemplate';
import { downloadExportFile } from '../../utils/exportDownload';

interface Obr1301State {
  taxpayerName: string;
  region: string;
  zone: string;
  woreda: string;
  kebele: string;
  houseNo: string;
  tin: string;
  taxAccountNumber: string;
  taxCenter: string;
  phone: string;
  fax: string;
  taxYear: string;
  checkScheduleC: boolean;
  checkMining: boolean;
  businessIncome: number; // Line 1 (box 5)
  nonOperatingIncome: number; // Line 2 (box 10)
  costOfGoodsSold: number; // Line 4 (box 20)
  sellingDistribution: number; // Line 6 (box 30)
  salaryWages: number; // Line 7 (box 35)
  otherEmployeeBenefits: number; // Line 8 (box 40)
  repairMaintenance: number; // Line 9 (box 45)
  investmentExpenses: number; // Line 10 (box 50)
  foreignTechnical: number; // Line 11 (box 55)
  utilities: number; // Line 12 (box 60)
  travel: number; // Line 13 (box 65)
  rentExpense: number; // Line 14 (box 70)
  interest: number; // Line 15 (box 75)
  depreciation: number; // Line 16 (box 80)
  amortization: number; // Line 17 (box 85)
  deductibleTaxes: number; // Line 18 (box 90)
  donations: number; // Line 19 (box 95)
  otherDeductible: number; // Line 20 (box 100)
  lossCarryForward: number; // Line 23 (box 115)
  lossAdjustment: number; // Line 24 (box 120)
  businessIncomeTaxDraft: number; // Line 26 (box 130)
  incomeTaxCredit: number; // Line 27 (box 135)
  foreignTax: number; // Line 28 (box 140)
  withholdingTax: number; // Line 29 (box 145)
  attachmentsChecked: string[];
}

const ATTACHMENT_OPTIONS = [
  'Balance Sheet',
  'Profit & Loss Statement',
  'Source & Application of Fund',
  'Fixed Asset & Depreciation Schedule',
  'Selling & Distribution Expenses',
  'Provisions & Reserves',
  'Statement of Goods Manufactured and/or Cost of Goods Sold',
  'Depletion & the Manner in which it is Computed',
];

function createDefaultObr1301(): Obr1301State {
  return {
    taxpayerName: 'SADIYA MOHAMMED (Sample Draft)',
    region: 'OROMIYA',
    zone: 'M/SHEWA',
    woreda: 'DIRE',
    kebele: '03',
    houseNo: '10',
    tin: '0027193563',
    taxAccountNumber: '',
    taxCenter: 'Adama / M.Shewa',
    phone: '0911253639',
    fax: '',
    taxYear: '2018',
    checkScheduleC: true,
    checkMining: false,
    businessIncome: 0,
    nonOperatingIncome: 0,
    costOfGoodsSold: 0,
    sellingDistribution: 0,
    salaryWages: 0,
    otherEmployeeBenefits: 0,
    repairMaintenance: 35000,
    investmentExpenses: 0,
    foreignTechnical: 0,
    utilities: 0,
    travel: 0,
    rentExpense: 0,
    interest: 0,
    depreciation: 0,
    amortization: 0,
    deductibleTaxes: 0,
    donations: 0,
    otherDeductible: 0,
    lossCarryForward: 0,
    lossAdjustment: 0,
    businessIncomeTaxDraft: 0,
    incomeTaxCredit: 0,
    foreignTax: 0,
    withholdingTax: 0,
    attachmentsChecked: ['Profit & Loss Statement'],
  };
}

interface CashAttachmentState {
  sellerName: string;
  sellerTradeLine: string;
  sellerTin: string;
  sellerVatReg: string;
  kebele: string;
  bldgHouseNo: string;
  tel: string;
  fsNo: string;
  invoiceNo: string;
  dateStr: string;
  timeStr: string;
  salesAgent: string;
  buyerName: string;
  buyerTin: string;
  itemCode: string;
  itemDescription: string;
  uom: string;
  quantity: number;
  unitPrice: number;
  taxRatePercent: number;
  amountInWords: string;
  ercaMachineId: string;
}

function createDefaultCashAttachment(): CashAttachmentState {
  return {
    sellerName: 'ABDULWEHAB DEKEBO TOLA (Sample)',
    sellerTradeLine: 'ADAMA EXPORT TRADE IN LIVESTOCK & VEHICLES',
    sellerTin: '0003496157',
    sellerVatReg: '3140270032',
    kebele: '02',
    bldgHouseNo: '1564',
    tel: '0949401224',
    fsNo: '00000073',
    invoiceNo: '00001340',
    dateStr: '01/07/2026',
    timeStr: '12:12',
    salesAgent: 'ABDULWEHAB DEKEBO',
    buyerName: 'habiba mohammednur kemer',
    buyerTin: '0089369475',
    itemCode: 'HOU123',
    itemDescription: 'House Rent',
    uom: 'month',
    quantity: 8,
    unitPrice: 21739.1304,
    taxRatePercent: 15,
    amountInWords: 'TWO HUNDRED THOUSAND BIRR AND CENTS',
    ercaMachineId: 'CLB0016221',
  };
}

export const TaxAndAttachmentSamples: React.FC = () => {
  const { activeOwner, ownerReceipts, ownerTenants, locale, notify } = usePrms();

  const [subMode, setSubMode] = useState<'obr1301' | 'cash-attachment'>('obr1301');
  const [obrForm, setObrForm] = useState<Obr1301State>(() => createDefaultObr1301());
  const [showObrScan, setShowObrScan] = useState(false);

  const [cashForm, setCashForm] = useState<CashAttachmentState>(() =>
    createDefaultCashAttachment()
  );
  const [showCashScan, setShowCashScan] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string>(
    ownerReceipts[0]?.id || ''
  );

  const obrTotals = useMemo(() => {
    const line3GrossIncome = obrForm.businessIncome + obrForm.nonOperatingIncome;
    const line5GrossProfit = line3GrossIncome - obrForm.costOfGoodsSold;
    const line21TotalExpenses =
      obrForm.sellingDistribution +
      obrForm.salaryWages +
      obrForm.otherEmployeeBenefits +
      obrForm.repairMaintenance +
      obrForm.investmentExpenses +
      obrForm.foreignTechnical +
      obrForm.utilities +
      obrForm.travel +
      obrForm.rentExpense +
      obrForm.interest +
      obrForm.depreciation +
      obrForm.amortization +
      obrForm.deductibleTaxes +
      obrForm.donations +
      obrForm.otherDeductible;
    const line22NetIncome = line5GrossProfit - line21TotalExpenses;
    const line25TaxableIncome =
      line22NetIncome - obrForm.lossCarryForward + obrForm.lossAdjustment;
    const line30TotalCredits =
      obrForm.incomeTaxCredit + obrForm.foreignTax + obrForm.withholdingTax;
    const netTaxDue = obrForm.businessIncomeTaxDraft - line30TotalCredits;
    return {
      line3GrossIncome,
      line5GrossProfit,
      line21TotalExpenses,
      line22NetIncome,
      line25TaxableIncome,
      line30TotalCredits,
      netTaxDue,
    };
  }, [obrForm]);

  const cashTotals = useMemo(() => {
    const subTotal = Math.round(cashForm.quantity * cashForm.unitPrice * 100) / 100;
    const taxAmount = Math.round(subTotal * (cashForm.taxRatePercent / 100) * 100) / 100;
    const grandTotal = Math.round((subTotal + taxAmount) * 100) / 100;
    return { subTotal, taxAmount, grandTotal };
  }, [cashForm.quantity, cashForm.unitPrice, cashForm.taxRatePercent]);

  const fmtNum = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleAutofillObrFromOwner = () => {
    setObrForm((prev) => ({
      ...prev,
      taxpayerName: activeOwner.name,
      tin: activeOwner.tinPlaceholder,
      phone: activeOwner.contactPlaceholder,
      region: 'OROMIYA',
    }));
    notify({
      tone: 'info',
      title: 'OBR Form 1301 Pre-filled',
      detail: `Populated illustrative draft header from ${activeOwner.name}.`,
    });
  };

  const handleLoadReceiptIntoAttachment = (receiptId: string) => {
    setSelectedReceiptId(receiptId);
    const rec = ownerReceipts.find((r) => r.id === receiptId);
    if (!rec) return;
    const tenant = ownerTenants.find((t) => t.id === rec.tenantId);
    const qty = 1;
    const taxRate = cashForm.taxRatePercent;
    const unitPrice = Math.round((rec.amountEtb / (1 + taxRate / 100)) * 10000) / 10000;
    setCashForm((prev) => ({
      ...prev,
      sellerName: activeOwner.name,
      sellerTin: activeOwner.tinPlaceholder,
      sellerVatReg: activeOwner.vatRegPlaceholder,
      salesAgent: activeOwner.name,
      buyerName: tenant?.name || prev.buyerName,
      buyerTin: tenant?.idPlaceholder || prev.buyerTin,
      invoiceNo: rec.allocations[0]?.invoiceNumber || rec.receiptNumber,
      dateStr: rec.paymentDate,
      itemDescription: rec.lineDescription || 'Commercial House Rent (Synthetic)',
      quantity: qty,
      unitPrice,
      amountInWords: `SYNTHETIC ${fmtNum(rec.amountEtb)} BIRR`,
    }));
  };

  const handleExportObr = (format: 'PDF' | 'Excel') => {
    const res = downloadExportFile(format, {
      title: `OBR Form 1301 Schedule C Draft - ${obrForm.taxpayerName}`,
      ownerName: activeOwner.name,
      columns: ['Line / Section', 'Description', 'Amount (ETB Draft)'],
      rows: [
        ['Sec 1.1', "Taxpayer's Name", obrForm.taxpayerName],
        ['Sec 1.2', 'Region / Zone / Woreda', `${obrForm.region} / ${obrForm.zone} / ${obrForm.woreda}`],
        ['Sec 1.3', 'TIN', obrForm.tin],
        ['Sec 1.8', 'For the Year of', obrForm.taxYear],
        ['Line 1 (Box 5)', 'Business Income or Sales / Turnover', fmtNum(obrForm.businessIncome)],
        ['Line 2 (Box 10)', 'Non Operating and Other Income', fmtNum(obrForm.nonOperatingIncome)],
        ['Line 3 (Box 15)', 'Total Gross Income', fmtNum(obrTotals.line3GrossIncome)],
        ['Line 4 (Box 20)', 'Cost of Goods Sold', fmtNum(obrForm.costOfGoodsSold)],
        ['Line 5 (Box 25)', 'Gross Profit / Loss', fmtNum(obrTotals.line5GrossProfit)],
        ['Line 9 (Box 45)', 'Repair and Maintenance Expenses', fmtNum(obrForm.repairMaintenance)],
        ['Line 12 (Box 60)', 'Utilities Expenses', fmtNum(obrForm.utilities)],
        ['Line 14 (Box 70)', 'Rent Expenses', fmtNum(obrForm.rentExpense)],
        ['Line 21 (Box 105)', 'Total Expenses', fmtNum(obrTotals.line21TotalExpenses)],
        ['Line 22 (Box 110)', 'Net Income / Loss', fmtNum(obrTotals.line22NetIncome)],
        ['Line 25 (Box 125)', 'Taxable Business Income', fmtNum(obrTotals.line25TaxableIncome)],
        ['Line 26 (Box 130)', 'Business Income Tax (Draft Placeholder)', fmtNum(obrForm.businessIncomeTaxDraft)],
        ['Line 30', 'Total Credits', fmtNum(obrTotals.line30TotalCredits)],
        ['Net (Box 150)', 'Net Tax Due / Refundable (Illustrative)', fmtNum(obrTotals.netTaxDue)],
      ],
      includeMetadataHeader: true,
      pdfOrientation: 'portrait',
    });
    notify({
      tone: 'success',
      title: `OBR Form 1301 ${format} Downloaded`,
      detail: `${res.filename} exported (illustrative draft only).`,
    });
  };

  const handleExportCashAttachment = (format: 'PDF' | 'Excel') => {
    const res = downloadExportFile(format, {
      title: `CASH Sales Attachment - ${cashForm.invoiceNo}`,
      ownerName: activeOwner.name,
      columns: ['Item Code', 'Description', 'UOM', 'Quantity', 'Unit Price', 'Total Price'],
      rows: [
        [
          cashForm.itemCode,
          cashForm.itemDescription,
          cashForm.uom,
          cashForm.quantity.toFixed(2),
          fmtNum(cashForm.unitPrice),
          fmtNum(cashTotals.subTotal),
        ],
        ['-', `Tax1 (${cashForm.taxRatePercent}%)`, '-', '-', '-', fmtNum(cashTotals.taxAmount)],
        ['-', 'Grand Total (Demo Attachment)', '-', '-', '-', fmtNum(cashTotals.grandTotal)],
      ],
      includeMetadataHeader: true,
      pdfOrientation: 'landscape',
    });
    notify({
      tone: 'success',
      title: `CASH Sales Attachment ${format} Downloaded`,
      detail: `${res.filename} exported (synthetic attachment template).`,
    });
  };

  const inputCls =
    'w-full px-2.5 py-1.5 bg-white dark:bg-[#162438] border border-[#CBD5E1] dark:border-[#2D405B] rounded-lg text-xs text-[#0F1D2F] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#166549]';

  return (
    <div className="space-y-4" data-testid="tax-and-attachment-samples">
      {/* Sub-mode switcher: OBR Form 1301 vs CASH Sales Attachment */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-[#EAEFF5] dark:bg-[#152236] rounded-xl">
          <button
            type="button"
            data-testid="subtab-obr-1301"
            onClick={() => setSubMode('obr1301')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer ${
              subMode === 'obr1301'
                ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>
              {biText(
                locale,
                'OBR Form 1301 (Schedule C Tax Return)',
                'OBR ቅጽ 1301 (የንግድ ገቢ ግብር ማሳወቂያ)'
              )}
            </span>
          </button>
          <button
            type="button"
            data-testid="subtab-cash-attachment"
            onClick={() => setSubMode('cash-attachment')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer ${
              subMode === 'cash-attachment'
                ? 'bg-white dark:bg-[#0F233A] text-[#0F233A] dark:text-[#E5B85C] shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <ReceiptText className="w-3.5 h-3.5" />
            <span>
              {biText(
                locale,
                'CASH Sales Attachment Sample',
                'የCASH ሽያጭ አባሪ (Attachment) ናሙና'
              )}
            </span>
          </button>
        </div>

        <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
          {biText(
            locale,
            'Illustrative Form Samples — Not Statutory Tax Filing',
            'ለማሳያ የሚያገለግሉ የቅጽ ናሙናዎች — ሕጋዊ የግብር ማሳወቂያ አይደሉም'
          )}
        </span>
      </div>

      {/* PANEL 1: OROMIA BUREAU OF REVENUES FORM 1301 SCHEDULE C */}
      {subMode === 'obr1301' && (
        <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-[#F8FAFC] dark:bg-[#152236] border-b border-[#DFE5EE] dark:border-[#233349] flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
                Business Income Tax Declaration — Schedule C (With Annex) · OBR Form 1301
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Oromia Bureau of Revenues · (Draft as of 4/7) OBR Form 1301 (5/2006) · Page 1 of 3
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleAutofillObrFromOwner}
                className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#111C2C] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5 text-[#166549]" />
                <span>Sync Owner</span>
              </button>
              <button
                type="button"
                onClick={() => setObrForm(createDefaultObr1301())}
                className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#111C2C] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Sample</span>
              </button>
              <button
                type="button"
                onClick={() => setShowObrScan((s) => !s)}
                className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#111C2C] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{showObrScan ? 'Hide Scan' : 'Original Scan'}</span>
              </button>
              <button
                type="button"
                data-testid="obr-download-pdf"
                onClick={() => handleExportObr('PDF')}
                className="px-2.5 py-1.5 rounded-lg bg-[#0F233A] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#E5B85C]" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                data-testid="obr-download-excel"
                onClick={() => handleExportObr('Excel')}
                className="px-2.5 py-1.5 rounded-lg bg-[#166549] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
            </div>
          </div>

          <div className="p-4 space-y-5 text-xs">
            {showObrScan && (
              <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-3 bg-slate-100 dark:bg-[#0B131E]">
                <img
                  src={TAX_FORM_SAMPLE_IMAGE}
                  alt="Attached OBR Form 1301 Schedule C sample"
                  className="w-full max-h-[520px] object-contain mx-auto rounded-lg"
                />
              </div>
            )}

            {/* Section 1: Taxpayer Information */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-[#DFE5EE] dark:border-[#233349]">
                <h4 className="font-bold text-[#0F233A] dark:text-[#E5B85C]">
                  Section 1 — Taxpayer Information
                </h4>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={obrForm.checkScheduleC}
                      onChange={(e) =>
                        setObrForm({ ...obrForm, checkScheduleC: e.target.checked })
                      }
                    />
                    <span>Schedule C Business Income Tax</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={obrForm.checkMining}
                      onChange={(e) =>
                        setObrForm({ ...obrForm, checkMining: e.target.checked })
                      }
                    />
                    <span>Mining Income Tax</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                <div className="md:col-span-5">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    1. Taxpayer&apos;s Name
                  </label>
                  <input
                    value={obrForm.taxpayerName}
                    onChange={(e) => setObrForm({ ...obrForm, taxpayerName: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    3. Taxpayer Identification No (TIN)
                  </label>
                  <input
                    value={obrForm.tin}
                    onChange={(e) => setObrForm({ ...obrForm, tin: e.target.value })}
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    8. For the Year of
                  </label>
                  <input
                    value={obrForm.taxYear}
                    onChange={(e) => setObrForm({ ...obrForm, taxYear: e.target.value })}
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    6. Telephone
                  </label>
                  <input
                    value={obrForm.phone}
                    onChange={(e) => setObrForm({ ...obrForm, phone: e.target.value })}
                    className={`${inputCls} font-mono`}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    2a. Region
                  </label>
                  <input
                    value={obrForm.region}
                    onChange={(e) => setObrForm({ ...obrForm, region: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    2b. Zone / K.Ketema
                  </label>
                  <input
                    value={obrForm.zone}
                    onChange={(e) => setObrForm({ ...obrForm, zone: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    2c. Woreda
                  </label>
                  <input
                    value={obrForm.woreda}
                    onChange={(e) => setObrForm({ ...obrForm, woreda: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    2d. Kebele
                  </label>
                  <input
                    value={obrForm.kebele}
                    onChange={(e) => setObrForm({ ...obrForm, kebele: e.target.value })}
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    2e. House No.
                  </label>
                  <input
                    value={obrForm.houseNo}
                    onChange={(e) => setObrForm({ ...obrForm, houseNo: e.target.value })}
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    5. Tax Center
                  </label>
                  <input
                    value={obrForm.taxCenter}
                    onChange={(e) => setObrForm({ ...obrForm, taxCenter: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Tax Declaration Lines 1-30 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-[#F8FAFC] dark:bg-[#152236] font-bold text-[#0F233A] dark:text-[#E5B85C] border-b border-[#DFE5EE] dark:border-[#233349]">
                  Section 2 — Income, Cost of Goods Sold &amp; Deductible Expenses (Lines 1–21)
                </div>
                <div className="divide-y divide-slate-100 dark:divide-[#233349]">
                  {[
                    {
                      line: '1',
                      box: '5',
                      label: 'Business Income or Sales/Turnover (Annex 1)',
                      val: obrForm.businessIncome,
                      set: (v: number) => setObrForm({ ...obrForm, businessIncome: v }),
                    },
                    {
                      line: '2',
                      box: '10',
                      label: 'Non Operating and Other Income',
                      val: obrForm.nonOperatingIncome,
                      set: (v: number) => setObrForm({ ...obrForm, nonOperatingIncome: v }),
                    },
                    {
                      line: '4',
                      box: '20',
                      label: 'Cost of Goods Sold / Direct Cost (Annex 2)',
                      val: obrForm.costOfGoodsSold,
                      set: (v: number) => setObrForm({ ...obrForm, costOfGoodsSold: v }),
                    },
                    {
                      line: '7',
                      box: '35',
                      label: 'Salary and Wages',
                      val: obrForm.salaryWages,
                      set: (v: number) => setObrForm({ ...obrForm, salaryWages: v }),
                    },
                    {
                      line: '9',
                      box: '45',
                      label: 'Repair and Maintenance Expenses',
                      val: obrForm.repairMaintenance,
                      set: (v: number) => setObrForm({ ...obrForm, repairMaintenance: v }),
                    },
                    {
                      line: '12',
                      box: '60',
                      label: 'Utilities Expenses',
                      val: obrForm.utilities,
                      set: (v: number) => setObrForm({ ...obrForm, utilities: v }),
                    },
                    {
                      line: '14',
                      box: '70',
                      label: 'Rent Expenses',
                      val: obrForm.rentExpense,
                      set: (v: number) => setObrForm({ ...obrForm, rentExpense: v }),
                    },
                    {
                      line: '16',
                      box: '80',
                      label: 'Depreciation Expenses',
                      val: obrForm.depreciation,
                      set: (v: number) => setObrForm({ ...obrForm, depreciation: v }),
                    },
                    {
                      line: '20',
                      box: '100',
                      label: 'Other Deductible Expenses (Annex 5)',
                      val: obrForm.otherDeductible,
                      set: (v: number) => setObrForm({ ...obrForm, otherDeductible: v }),
                    },
                  ].map((row) => (
                    <div key={row.line} className="px-3 py-2 flex items-center justify-between gap-2">
                      <span className="text-slate-700 dark:text-slate-300">
                        <strong className="font-mono text-[#0F233A] dark:text-[#E5B85C]">
                          {row.line}.
                        </strong>{' '}
                        {row.label}{' '}
                        <span className="text-[10px] font-mono text-slate-400">[{row.box}]</span>
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={row.val}
                        onChange={(e) => row.set(Number(e.target.value) || 0)}
                        className="w-28 px-2 py-1 rounded border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#162438] text-right font-mono tabular-nums"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-[#F8FAFC] dark:bg-[#152236] font-bold text-[#0F233A] dark:text-[#E5B85C] border-b border-[#DFE5EE] dark:border-[#233349]">
                    Calculation of Tax Due (Lines 22–30 · Illustrative Only)
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-[#233349]">
                    <div className="px-3 py-2 flex justify-between font-mono">
                      <span>3. Total Gross Income [15]</span>
                      <strong>{fmtNum(obrTotals.line3GrossIncome)}</strong>
                    </div>
                    <div className="px-3 py-2 flex justify-between font-mono">
                      <span>5. Gross Profit / Loss [25]</span>
                      <strong>{fmtNum(obrTotals.line5GrossProfit)}</strong>
                    </div>
                    <div className="px-3 py-2 flex justify-between font-mono">
                      <span>21. Total Expenses [105]</span>
                      <strong>{fmtNum(obrTotals.line21TotalExpenses)}</strong>
                    </div>
                    <div className="px-3 py-2 flex justify-between font-mono bg-[#F8FAFC] dark:bg-[#152236]">
                      <span>22. Net Income / Loss [110]</span>
                      <strong>{fmtNum(obrTotals.line22NetIncome)}</strong>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between gap-2">
                      <span>23. Loss Carry Forward [115]</span>
                      <input
                        type="number"
                        step="0.01"
                        value={obrForm.lossCarryForward}
                        onChange={(e) =>
                          setObrForm({ ...obrForm, lossCarryForward: Number(e.target.value) || 0 })
                        }
                        className="w-28 px-2 py-1 rounded border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#162438] text-right font-mono tabular-nums"
                      />
                    </div>
                    <div className="px-3 py-2 flex justify-between font-mono">
                      <span>25. Taxable Business Income [125]</span>
                      <strong>{fmtNum(obrTotals.line25TaxableIncome)}</strong>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between gap-2">
                      <span>26. Business Income Tax (Draft) [130]</span>
                      <input
                        type="number"
                        step="0.01"
                        value={obrForm.businessIncomeTaxDraft}
                        onChange={(e) =>
                          setObrForm({
                            ...obrForm,
                            businessIncomeTaxDraft: Number(e.target.value) || 0,
                          })
                        }
                        className="w-28 px-2 py-1 rounded border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#162438] text-right font-mono tabular-nums"
                      />
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between gap-2">
                      <span>29. Withholding Tax Credit [145]</span>
                      <input
                        type="number"
                        step="0.01"
                        value={obrForm.withholdingTax}
                        onChange={(e) =>
                          setObrForm({ ...obrForm, withholdingTax: Number(e.target.value) || 0 })
                        }
                        className="w-28 px-2 py-1 rounded border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#162438] text-right font-mono tabular-nums"
                      />
                    </div>
                    <div className="px-3 py-2.5 flex justify-between font-mono bg-[#0D1D30] text-white">
                      <span>Net Tax Due / Refundable [150]</span>
                      <strong className="text-[#E5B85C]">{fmtNum(obrTotals.netTaxDue)}</strong>
                    </div>
                  </div>
                </div>

                {/* Section 3: Attachments Checklist */}
                <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-3 space-y-2">
                  <p className="font-bold text-[#0F233A] dark:text-[#E5B85C] inline-flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Section 3 — Attachments Checklist</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {ATTACHMENT_OPTIONS.map((opt) => {
                      const checked = obrForm.attachmentsChecked.includes(opt);
                      return (
                        <label
                          key={opt}
                          className="inline-flex items-start gap-2 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setObrForm((prev) => ({
                                ...prev,
                                attachmentsChecked: checked
                                  ? prev.attachmentsChecked.filter((x) => x !== opt)
                                  : [...prev.attachmentsChecked, opt],
                              }))
                            }
                            className="mt-0.5"
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* PANEL 2: CASH SALES ATTACHMENT SAMPLE */}
      {subMode === 'cash-attachment' && (
        <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-[#F8FAFC] dark:bg-[#152236] border-b border-[#DFE5EE] dark:border-[#233349] flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#0F233A] dark:text-slate-100">
                CASH Sales Attachment (House Rent · Synthetic Sample)
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Mirrors the attached ERCA fiscal slip + CASH Sales Attachment breakdown.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {ownerReceipts.length > 0 && (
                <select
                  aria-label="Load receipt into CASH attachment"
                  value={selectedReceiptId}
                  onChange={(e) => handleLoadReceiptIntoAttachment(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#111C2C] text-xs"
                >
                  <option value="">Load synthetic receipt...</option>
                  {ownerReceipts.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.receiptNumber} ({fmtNum(r.amountEtb)})
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => setCashForm(createDefaultCashAttachment())}
                className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#111C2C] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Sample</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCashScan((s) => !s)}
                className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#111C2C] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{showCashScan ? 'Hide Scan' : 'Original Scan'}</span>
              </button>
              <button
                type="button"
                data-testid="cash-attachment-download-pdf"
                onClick={() => handleExportCashAttachment('PDF')}
                className="px-2.5 py-1.5 rounded-lg bg-[#0F233A] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#E5B85C]" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                data-testid="cash-attachment-download-excel"
                onClick={() => handleExportCashAttachment('Excel')}
                className="px-2.5 py-1.5 rounded-lg bg-[#166549] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4 text-xs">
            {showCashScan && (
              <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-3 bg-slate-100 dark:bg-[#0B131E]">
                <img
                  src={CASH_ATTACHMENT_SAMPLE_IMAGE}
                  alt="Attached CASH Sales Attachment sample"
                  className="w-full max-h-[520px] object-contain mx-auto rounded-lg"
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Editable Fields */}
              <div className="lg:col-span-5 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      FS No.
                    </label>
                    <input
                      value={cashForm.fsNo}
                      onChange={(e) => setCashForm({ ...cashForm, fsNo: e.target.value })}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Invoice No.
                    </label>
                    <input
                      value={cashForm.invoiceNo}
                      onChange={(e) => setCashForm({ ...cashForm, invoiceNo: e.target.value })}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Seller / Trade Name
                  </label>
                  <input
                    value={cashForm.sellerName}
                    onChange={(e) => setCashForm({ ...cashForm, sellerName: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Buyer / Customer Name
                    </label>
                    <input
                      value={cashForm.buyerName}
                      onChange={(e) => setCashForm({ ...cashForm, buyerName: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Buyer TIN
                    </label>
                    <input
                      value={cashForm.buyerTin}
                      onChange={(e) => setCashForm({ ...cashForm, buyerTin: e.target.value })}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Item Code
                    </label>
                    <input
                      value={cashForm.itemCode}
                      onChange={(e) => setCashForm({ ...cashForm, itemCode: e.target.value })}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Quantity (Months)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={cashForm.quantity}
                      onChange={(e) =>
                        setCashForm({ ...cashForm, quantity: Number(e.target.value) || 0 })
                      }
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Unit Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={cashForm.unitPrice}
                      onChange={(e) =>
                        setCashForm({ ...cashForm, unitPrice: Number(e.target.value) || 0 })
                      }
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Amount in Words
                  </label>
                  <input
                    value={cashForm.amountInWords}
                    onChange={(e) => setCashForm({ ...cashForm, amountInWords: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Rendered Attachment Preview Card */}
              <div className="lg:col-span-7 relative border border-slate-300 dark:border-[#2D405B] rounded-xl p-5 bg-[#FAFBFD] dark:bg-[#0D1D30] overflow-hidden">
                <div
                  aria-hidden="true"
                  className="pointer-events-none select-none absolute inset-0 flex items-center justify-center opacity-10"
                >
                  <span className="text-5xl font-black tracking-[0.2em] -rotate-25 text-slate-500">
                    ATTACHMENT
                  </span>
                </div>

                <div className="relative space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-300 dark:border-[#2D405B] pb-2">
                    <div>
                      <p className="font-bold text-[#0F233A] dark:text-[#E5B85C]">
                        {cashForm.sellerTradeLine}
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        TIN: {cashForm.sellerTin} · VAT Reg. No.: {cashForm.sellerVatReg} · Kebele:{' '}
                        {cashForm.kebele} · Bldg/H.No: {cashForm.bldgHouseNo}
                      </p>
                    </div>
                    <div className="text-right font-mono text-[11px]">
                      <p className="font-bold">CASH Sales Attachment</p>
                      <p>FS No.: {cashForm.fsNo}</p>
                      <p>Invoice No.: {cashForm.invoiceNo}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <p>
                      <strong>Customer:</strong> {cashForm.buyerName}
                    </p>
                    <p className="text-right font-mono">
                      <strong>Buyer TIN:</strong> {cashForm.buyerTin}
                    </p>
                    <p>
                      <strong>Sales Agent:</strong> {cashForm.salesAgent}
                    </p>
                    <p className="text-right font-mono">
                      {cashForm.dateStr} {cashForm.timeStr}
                    </p>
                  </div>

                  <table className="w-full border-collapse text-[11px] font-mono">
                    <thead>
                      <tr className="bg-slate-200/70 dark:bg-[#152236]">
                        <th className="border border-slate-300 dark:border-[#2D405B] p-1.5 text-left">
                          Item Code
                        </th>
                        <th className="border border-slate-300 dark:border-[#2D405B] p-1.5 text-left">
                          UOM
                        </th>
                        <th className="border border-slate-300 dark:border-[#2D405B] p-1.5 text-right">
                          Quantity
                        </th>
                        <th className="border border-slate-300 dark:border-[#2D405B] p-1.5 text-right">
                          Unit Price
                        </th>
                        <th className="border border-slate-300 dark:border-[#2D405B] p-1.5 text-right">
                          Total Price
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-300 dark:border-[#2D405B] p-1.5">
                          {cashForm.itemCode} ({cashForm.itemDescription})
                        </td>
                        <td className="border border-slate-300 dark:border-[#2D405B] p-1.5">
                          {cashForm.uom}
                        </td>
                        <td className="border border-slate-300 dark:border-[#2D405B] p-1.5 text-right">
                          {cashForm.quantity.toFixed(2)}
                        </td>
                        <td className="border border-slate-300 dark:border-[#2D405B] p-1.5 text-right">
                          {fmtNum(cashForm.unitPrice)}
                        </td>
                        <td className="border border-slate-300 dark:border-[#2D405B] p-1.5 text-right">
                          {fmtNum(cashTotals.subTotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="flex flex-col items-end font-mono text-[11px] space-y-0.5">
                    <p>Sub Total: {fmtNum(cashTotals.subTotal)}</p>
                    <p>
                      Tax1 ({cashForm.taxRatePercent}%): {fmtNum(cashTotals.taxAmount)}
                    </p>
                    <p className="font-bold text-xs text-[#0F233A] dark:text-[#E5B85C]">
                      Grand Total: {fmtNum(cashTotals.grandTotal)}
                    </p>
                  </div>

                  <p className="text-[11px] italic text-slate-600 dark:text-slate-300">
                    Amount in words: {cashForm.amountInWords}
                  </p>
                  <p className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 pt-1 border-t border-slate-300 dark:border-[#2D405B]">
                    ERCA {cashForm.ercaMachineId} · This receipt is not valid unless the fiscal receipt is attached! (Illustrative Demo Sample Only)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
