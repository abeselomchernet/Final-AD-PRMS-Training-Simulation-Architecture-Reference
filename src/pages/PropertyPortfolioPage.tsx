import React, { useMemo, useState } from 'react';
import { Building2, MapPin, Plus, RefreshCw, ShieldAlert } from 'lucide-react';
import { biText } from '../data/i18n';
import { usePrms } from '../context/PrmsContext';
import { checkActionPermission } from '../policies/rbac';
import { UnitRecord, UnitStatus } from '../types/prms';
import {
  EmptyState,
  GovernanceCallout,
  Modal,
  SlideDrawer,
  StatusLabel,
} from '../components/ui/Primitives';

const UNIT_STATUSES: UnitStatus[] = ['Vacant', 'Occupied', 'Maintenance', 'Reserved', 'Inactive'];

export const PropertyPortfolioPage: React.FC = () => {
  const {
    activeOwner,
    currentPersona,
    ownerProperties,
    ownerBuildings,
    ownerUnits,
    ownerTenants,
    ownerLeases,
    createProperty,
    createUnit,
    updateUnitStatus,
    requestUnitRenumbering,
    requestOwnershipChange,
    locale,
    fmtDate,
    fmtEtb,
    trStatus,
    labels,
  } = usePrms();

  const [statusFilter, setStatusFilter] = useState<'All' | UnitStatus>('All');
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [unitTab, setUnitTab] = useState<'overview' | 'occupancy' | 'history'>('overview');

  const [createPropOpen, setCreatePropOpen] = useState(false);
  const [createUnitOpen, setCreateUnitOpen] = useState(false);
  const [renumberModalUnit, setRenumberModalUnit] = useState<UnitRecord | null>(null);
  const [ownershipModalPropId, setOwnershipModalPropId] = useState<string | null>(null);

  const [propForm, setPropForm] = useState({
    name: '',
    code: '',
    propertyType: 'Commercial Office' as 'Mixed-Use Commercial' | 'Commercial Office',
    subCity: 'Bole Sub-City (Synthetic)',
    woreda: 'Woreda 03',
    streetPlaceholder: 'Synthetic Commercial Corridor',
    evidenceRef: 'EVD-PROP-DEMO-009',
  });

  const [unitForm, setUnitForm] = useState({
    code: '',
    name: '',
    floor: 2,
    areaSqm: 95,
    unitType: 'Office Suite' as 'Retail Ground' | 'Office Suite' | 'Commercial Hall',
    status: 'Vacant' as UnitStatus,
    baseRentEtb: 35000,
    evidenceRef: 'EVD-UNIT-DEMO-009',
  });

  const [renumberForm, setRenumberForm] = useState({
    newCode: '',
    effectiveDate: '2026-12-01',
    evidenceRef: '',
    reason: '',
  });

  const [ownershipForm, setOwnershipForm] = useState({
    proposedOwnerName: '',
    effectiveDate: '2026-12-01',
    evidenceRef: '',
    reason: '',
  });

  const [statusChangeNote, setStatusChangeNote] = useState('');

  const canMutatePortfolio = checkActionPermission(currentPersona.role, 'create_property_unit');
  const canRequestRenumber = checkActionPermission(currentPersona.role, 'request_unit_renumber');
  const canRequestOwnership = checkActionPermission(currentPersona.role, 'request_ownership_change');

  const filteredUnits = useMemo(
    () =>
      statusFilter === 'All'
        ? ownerUnits
        : ownerUnits.filter((u) => u.status === statusFilter),
    [ownerUnits, statusFilter]
  );

  const selectedUnit = useMemo(
    () => ownerUnits.find((u) => u.id === selectedUnitId) || null,
    [ownerUnits, selectedUnitId]
  );

  const floors = useMemo(() => {
    const set = new Set<number>(filteredUnits.map((u) => u.floor));
    return Array.from(set).sort((a, b) => b - a);
  }, [filteredUnits]);

  const handleCreateProp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propForm.name.trim() || !propForm.code.trim()) return;
    if (createProperty(propForm)) {
      setCreatePropOpen(false);
      setPropForm({
        name: '',
        code: '',
        propertyType: 'Commercial Office',
        subCity: 'Bole Sub-City (Synthetic)',
        woreda: 'Woreda 03',
        streetPlaceholder: 'Synthetic Commercial Corridor',
        evidenceRef: 'EVD-PROP-DEMO-009',
      });
    }
  };

  const handleCreateUnit = (e: React.FormEvent) => {
    e.preventDefault();
    const prop = ownerProperties[0];
    const bld = ownerBuildings[0];
    if (!prop || !bld || !unitForm.code.trim()) return;
    if (
      createUnit({
        propertyId: prop.id,
        buildingId: bld.id,
        ...unitForm,
        name: unitForm.name.trim() || `SYNTH Unit ${unitForm.code.trim()}`,
      })
    ) {
      setCreateUnitOpen(false);
      setUnitForm({
        code: '',
        name: '',
        floor: 2,
        areaSqm: 95,
        unitType: 'Office Suite',
        status: 'Vacant',
        baseRentEtb: 35000,
        evidenceRef: 'EVD-UNIT-DEMO-009',
      });
    }
  };

  const handleRenumberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renumberModalUnit || !renumberForm.newCode.trim() || !renumberForm.evidenceRef.trim()) return;
    if (
      requestUnitRenumbering({
        unitId: renumberModalUnit.id,
        newCode: renumberForm.newCode.trim(),
        effectiveDate: renumberForm.effectiveDate,
        evidenceRef: renumberForm.evidenceRef.trim(),
        reason: renumberForm.reason.trim() || 'Unit numbering update with preserved history.',
      })
    ) {
      setRenumberModalUnit(null);
      setRenumberForm({ newCode: '', effectiveDate: '2026-12-01', evidenceRef: '', reason: '' });
    }
  };

  const handleOwnershipSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownershipModalPropId || !ownershipForm.proposedOwnerName.trim() || !ownershipForm.evidenceRef.trim())
      return;
    if (
      requestOwnershipChange({
        propertyId: ownershipModalPropId,
        proposedOwnerName: ownershipForm.proposedOwnerName.trim(),
        effectiveDate: ownershipForm.effectiveDate,
        evidenceRef: ownershipForm.evidenceRef.trim(),
        reason: ownershipForm.reason.trim() || 'Requested property ownership transfer simulation.',
      })
    ) {
      setOwnershipModalPropId(null);
      setOwnershipForm({
        proposedOwnerName: '',
        effectiveDate: '2026-12-01',
        evidenceRef: '',
        reason: '',
      });
    }
  };

  const inputCls =
    'w-full px-3 py-2 bg-white dark:bg-[#162438] border border-[#CBD5E1] dark:border-[#2D405B] rounded-lg text-[#0F1D2F] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#166549]';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GovernanceCallout
          title={biText(
            locale,
            `Portfolio Hierarchy — ${activeOwner.name}`,
            `የንብረት መዋቅር (Portfolio) — ${activeOwner.name}`
          )}
          description={biText(
            locale,
            'Property → Building → Floor → Unit hierarchy. Sensitive changes (unit renumbering, ownership transfers) require evidence references and maker-checker approval.',
            'ንብረት → ሕንፃ → ፎቅ → ክፍል መዋቅር። ስሱ ለውጦች (የክፍል ቁጥር መቀየር፣ የባለቤትነት ዝውውር) የማስረጃ ማጣቀሻና የአዘጋጅ-አጽዳቂ ፍቃድ ይጠይቃሉ።'
          )}
          controlType="Prototype Simulation"
          action={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canMutatePortfolio.allowed}
                title={canMutatePortfolio.reason}
                onClick={() => setCreatePropOpen(true)}
                className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#162438] hover:bg-slate-50 dark:hover:bg-[#1B2B44] text-xs font-semibold text-[#0F233A] dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{biText(locale, 'Add Property', 'ንብረት ጨምር')}</span>
              </button>
              <button
                type="button"
                disabled={!canMutatePortfolio.allowed}
                title={canMutatePortfolio.reason}
                onClick={() => setCreateUnitOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{biText(locale, 'Add Unit', 'ክፍል ጨምር')}</span>
              </button>
            </div>
          }
        />
      </div>

      {/* Property & Building Cards + Map Placeholder */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          {ownerProperties.map((prop) => {
            const propBuildings = ownerBuildings.filter((b) => b.propertyId === prop.id);
            return (
              <div
                key={prop.id}
                className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#DFE5EE] dark:border-[#233349] pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#0F233A] dark:text-[#E5B85C]" />
                      <h2 className="text-base font-bold text-[#0F233A] dark:text-slate-100">{prop.name}</h2>
                      <StatusLabel label={prop.status} />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {prop.code} · {prop.propertyType} · {biText(locale, 'Effective', 'ተፈጻሚ')}{' '}
                      {fmtDate(prop.effectiveDate)} · {biText(locale, 'Evidence', 'ማስረጃ')}:{' '}
                      <span className="font-mono">{prop.evidenceRef}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canRequestOwnership.allowed}
                    title={canRequestOwnership.reason}
                    onClick={() => setOwnershipModalPropId(prop.id)}
                    className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#162438] hover:bg-slate-50 dark:hover:bg-[#1B2B44] text-xs font-medium text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {biText(locale, 'Request Ownership Change', 'የባለቤትነት ለውጥ ጠይቅ')}
                  </button>
                </div>

                {/* Buildings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {propBuildings.map((bld) => {
                    const bldUnits = ownerUnits.filter((u) => u.buildingId === bld.id);
                    const occupiedCount = bldUnits.filter((u) => u.status === 'Occupied').length;
                    return (
                      <div
                        key={bld.id}
                        className="border border-[#DFE5EE] dark:border-[#233349] rounded-lg p-3.5 bg-[#F4F6F9] dark:bg-[#162438]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#0F233A] dark:text-slate-100">{bld.name}</p>
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{bld.code}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          {bld.floors} {biText(locale, 'floors', 'ፎቆች')} · {bldUnits.length}{' '}
                          {biText(locale, 'units', 'ክፍሎች')} ({occupiedCount}{' '}
                          {biText(locale, 'occupied', 'ተከራይተዋል')}) · {bld.yearBuiltPlaceholder}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Map-Like Synthetic Address Card Placeholder */}
        <div className="lg:col-span-4 bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#DFE5EE] dark:border-[#233349] pb-3">
              <h2 className="text-sm font-semibold text-[#0F233A] dark:text-slate-100">
                {biText(locale, 'Synthetic Location Card', 'ሰው-ሠራሽ የአድራሻ ካርድ')}
              </h2>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {biText(locale, 'Placeholder', 'ምትክ')}
              </span>
            </div>

            {ownerProperties[0] && (
              <>
                <div className="mt-4 rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-[#F4F6F9] dark:bg-[#162438] p-4 relative overflow-hidden">
                  <svg viewBox="0 0 280 120" className="w-full h-28">
                    <rect width="280" height="120" className="fill-slate-100 dark:fill-[#0F1E30]" />
                    <path d="M0 30 H280 M0 75 H280 M70 0 V120 M190 0 V120" className="stroke-slate-300 dark:stroke-[#233349]" strokeWidth="2" />
                    <path d="M20 110 L250 15" className="stroke-slate-400 dark:stroke-slate-600" strokeWidth="1.5" strokeDasharray="4 4" />
                    <circle cx="140" cy="58" r="11" fill="#166549" opacity="0.25" />
                    <circle cx="140" cy="58" r="5" fill="#248F64" />
                  </svg>
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#0F233A] dark:text-slate-100">
                    <MapPin className="w-3.5 h-3.5 text-[#166549] dark:text-emerald-400" />
                    <span>{ownerProperties[0].addressCard.subCity}</span>
                  </div>
                </div>

                <dl className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500 dark:text-slate-400">{biText(locale, 'Woreda', 'ወረዳ')}</dt>
                    <dd className="font-medium text-slate-900 dark:text-slate-100">{ownerProperties[0].addressCard.woreda}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500 dark:text-slate-400">{biText(locale, 'Street', 'መንገድ')}</dt>
                    <dd className="font-medium text-slate-900 dark:text-slate-100">
                      {ownerProperties[0].addressCard.streetPlaceholder}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500 dark:text-slate-400">{biText(locale, 'Landmark', 'ምልክት')}</dt>
                    <dd className="font-medium text-slate-900 dark:text-slate-100">
                      {ownerProperties[0].addressCard.landmarkPlaceholder}
                    </dd>
                  </div>
                </dl>
              </>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-4 pt-3 border-t border-slate-100 dark:border-[#233349]">
            {ownerProperties[0]?.addressCard.geoNote}
          </p>
        </div>
      </section>

      {/* Floor Plan-Style Unit Grid */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DFE5EE] dark:border-[#233349] pb-3">
          <div>
            <h2 className="text-sm font-semibold text-[#0F233A] dark:text-slate-100">
              {biText(
                locale,
                `Floor-Plan Unit Grid (${filteredUnits.length})`,
                `በፎቅ የተደራጁ ክፍሎች (${filteredUnits.length})`
              )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {biText(
                locale,
                'Click any unit to inspect occupancy, history, preserved aliases, or submit a renumbering request.',
                'የመከራየት ሁኔታን፣ ታሪክን፣ የቀድሞ መለያዎችን ለማየት ወይም የቁጥር ለውጥ ለመጠየቅ ክፍሉን ይጫኑ።'
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-[#162438] rounded-lg">
            {(['All', ...UNIT_STATUSES] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  statusFilter === status
                    ? 'bg-white dark:bg-[#0D1D30] text-[#0F233A] dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {status === 'All' ? biText(locale, 'All', 'ሁሉም') : trStatus(status)}
              </button>
            ))}
          </div>
        </div>

        {filteredUnits.length === 0 ? (
          <EmptyState
            title={biText(locale, 'No Units Match Selected Filter', 'ከተመረጠው ማጣሪያ ጋር የሚዛመድ ክፍል የለም')}
            description={biText(
              locale,
              `There are no ${statusFilter} units in ${activeOwner.name}'s portfolio.`,
              `በ ${activeOwner.name} ንብረቶች ውስጥ በዚህ ሁኔታ ላይ ያለ ክፍል የለም።`
            )}
            action={
              <button
                type="button"
                onClick={() => setStatusFilter('All')}
                className="px-3 py-1.5 rounded-md border border-[#CBD5E1] dark:border-[#2D405B] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#162438]"
              >
                {biText(locale, 'Show All Units', 'ሁሉንም ክፍሎች አሳይ')}
              </button>
            }
          />
        ) : (
          <div className="space-y-5">
            {floors.map((floor) => {
              const floorUnits = filteredUnits.filter((u) => u.floor === floor);
              return (
                <div key={floor} className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {biText(locale, `Floor ${floor}`, `ፎቅ ${floor}`)}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono">
                      {floorUnits.length} {biText(locale, 'unit(s)', 'ክፍል(ሎች)')}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {floorUnits.map((unit) => {
                      const tenant = ownerTenants.find((t) => t.id === unit.currentTenantId);
                      return (
                        <button
                          key={unit.id}
                          type="button"
                          onClick={() => {
                            setSelectedUnitId(unit.id);
                            setUnitTab('overview');
                          }}
                          className="text-left border border-[#DFE5EE] dark:border-[#233349] hover:border-[#166549] dark:hover:border-emerald-400 rounded-xl p-4 bg-[#F8FAFC] dark:bg-[#152236] hover:bg-white dark:hover:bg-[#18273E] transition-colors cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold text-[#0F233A] dark:text-slate-100">{unit.name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {unit.unitType} · {unit.areaSqm} sqm
                              </p>
                            </div>
                            <StatusLabel label={unit.status} />
                          </div>
                          <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-[#233349] flex items-center justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-300 truncate">
                              {tenant ? tenant.name : biText(locale, 'Unassigned', 'ያልተመደበ')}
                            </span>
                            <span className="font-mono font-semibold text-[#0F233A] dark:text-[#E5B85C] tabular-nums shrink-0">
                              {fmtEtb(unit.baseRentEtb)}
                            </span>
                          </div>
                          {unit.previousIdentifiers.length > 0 && (
                            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1.5">
                              {biText(locale, 'Prior ID(s):', 'የቀድሞ መለያ(ዎች):')}{' '}
                              {unit.previousIdentifiers.join(', ')}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Unit Detail Drawer */}
      <SlideDrawer
        open={Boolean(selectedUnit)}
        onClose={() => setSelectedUnitId(null)}
        title={selectedUnit ? `${selectedUnit.name} (${selectedUnit.code})` : ''}
        subtitle={
          selectedUnit
            ? `${biText(locale, 'Floor', 'ፎቅ')} ${selectedUnit.floor} · ${selectedUnit.unitType} · ${selectedUnit.areaSqm} sqm`
            : undefined
        }
      >
        {selectedUnit && (
          <div className="space-y-5">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#162438] rounded-lg w-fit">
              {(['overview', 'occupancy', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setUnitTab(tab)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    unitTab === tab
                      ? 'bg-white dark:bg-[#0D1D30] text-[#0F233A] dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tab === 'overview'
                    ? biText(locale, 'Overview', 'አጠቃላይ')
                    : tab === 'occupancy'
                      ? biText(locale, 'Occupancy', 'ተከራይ')
                      : biText(locale, 'History', 'ታሪክ')}
                </button>
              ))}
            </div>

            {unitTab === 'overview' && (
              <div className="space-y-5">
                <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 space-y-3 bg-[#F8FAFC] dark:bg-[#152236]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {biText(locale, 'Current Unit State', 'የክፍሉ አሁናዊ ሁኔታ')}
                    </span>
                    <StatusLabel label={selectedUnit.status} />
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">{biText(locale, 'Current Code', 'የአሁኑ ኮድ')}</dt>
                      <dd className="font-mono font-semibold text-slate-900 dark:text-slate-100">{selectedUnit.code}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">
                        {biText(locale, 'Base Synthetic Rent', 'መሠረታዊ ሰው-ሠራሽ ኪራይ')}
                      </dt>
                      <dd className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {fmtEtb(selectedUnit.baseRentEtb)}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-slate-500 dark:text-slate-400">
                        {biText(locale, 'Preserved Previous Identifiers', 'ተጠብቀው የቆዩ የቀድሞ መለያዎች')}
                      </dt>
                      <dd className="font-mono text-slate-900 dark:text-slate-200 mt-0.5">
                        {selectedUnit.previousIdentifiers.length > 0
                          ? selectedUnit.previousIdentifiers.join(', ')
                          : biText(locale, 'None', 'የለም')}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Actions */}
                <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-[#0F233A] dark:text-slate-100">
                    {biText(locale, 'Controlled Unit Actions', 'ቁጥጥር የሚደረግባቸው የክፍል እርምጃዎች')}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!canRequestRenumber.allowed}
                      title={canRequestRenumber.reason}
                      onClick={() => {
                        setRenumberModalUnit(selectedUnit);
                        setRenumberForm({
                          newCode: '',
                          effectiveDate: '2026-12-01',
                          evidenceRef: 'EVD-REN-DEMO',
                          reason: '',
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#0F233A] hover:bg-[#193656] dark:bg-[#166549] dark:hover:bg-[#12533B] text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{biText(locale, 'Request Unit Renumbering', 'የክፍል ቁጥር ለውጥ ጠይቅ')}</span>
                    </button>
                  </div>

                  {/* Quick status transition */}
                  <div className="pt-3 border-t border-[#DFE5EE] dark:border-[#233349] space-y-2">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                      {biText(
                        locale,
                        'Operational Status Transition (logged to audit trail)',
                        'የክፍል ሁኔታ ሽግግር (በኦዲት መዝገብ ይቀመጣል)'
                      )}
                    </label>
                    <input
                      type="text"
                      value={statusChangeNote}
                      onChange={(e) => setStatusChangeNote(e.target.value)}
                      placeholder={biText(
                        locale,
                        'Reason / evidence note for status change...',
                        'የሁኔታ ለውጥ ምክንያት / የማስረጃ ማስታወሻ...'
                      )}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#162438] border border-[#CBD5E1] dark:border-[#2D405B] rounded-md text-[#0F1D2F] dark:text-slate-100"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {UNIT_STATUSES.map((st) => (
                        <button
                          key={st}
                          type="button"
                          disabled={!canMutatePortfolio.allowed || st === selectedUnit.status}
                          title={canMutatePortfolio.reason}
                          onClick={() => {
                            updateUnitStatus(
                              selectedUnit.id,
                              st,
                              statusChangeNote.trim() || `Transitioned status to ${st}`,
                              'EVD-STATUS-DEMO'
                            );
                            setStatusChangeNote('');
                          }}
                          className="px-2.5 py-1 rounded border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#162438] hover:bg-slate-50 dark:hover:bg-[#1B2B44] text-xs text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                        >
                          {biText(locale, `Set ${st}`, `አድርግ: ${trStatus(st)}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {unitTab === 'occupancy' && (
              <div className="space-y-3">
                {selectedUnit.currentLeaseId ? (
                  (() => {
                    const lease = ownerLeases.find((l) => l.id === selectedUnit.currentLeaseId);
                    const tenant = ownerTenants.find((t) => t.id === selectedUnit.currentTenantId);
                    return (
                      <div className="border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 space-y-2 text-xs">
                        <p className="font-semibold text-[#0F233A] dark:text-slate-100">
                          {biText(locale, 'Current Synthetic Assignment', 'አሁናዊ ሰው-ሠራሽ ምደባ')}
                        </p>
                        <p>
                          {biText(locale, 'Tenant', 'ተከራይ')}:{' '}
                          <span className="font-semibold">{tenant?.name || '—'}</span>
                        </p>
                        <p>
                          {biText(locale, 'Lease', 'ውል')}:{' '}
                          <span className="font-mono">
                            {lease ? `${lease.leaseNumber} (v${lease.version})` : '—'}
                          </span>
                        </p>
                        <p>
                          {biText(locale, 'Term', 'የውል ዘመን')}:{' '}
                          <span className="font-mono">
                            {lease ? `${fmtDate(lease.startDate)} → ${fmtDate(lease.endDate)}` : '—'}
                          </span>
                        </p>
                        <p>
                          {biText(locale, 'Monthly Rent', 'ወርሃዊ ኪራይ')}:{' '}
                          <span className="font-mono font-semibold">
                            {lease ? fmtEtb(lease.monthlyRentEtb) : '—'}
                          </span>
                        </p>
                      </div>
                    );
                  })()
                ) : (
                  <EmptyState
                    title={biText(locale, 'No Active Tenant Assigned', 'ንቁ ተከራይ አልተመደበም')}
                    description={biText(
                      locale,
                      'Create a synthetic lease in Tenants & Leases to assign an occupant to this unit.',
                      'ለዚህ ክፍል ተከራይ ለመመደብ በ "ተከራዮችና ውሎች" ገጽ አዲስ ሰው-ሠራሽ ውል ይፍጠሩ።'
                    )}
                  />
                )}
              </div>
            )}

            {unitTab === 'history' && (
              <div className="space-y-3">
                {selectedUnit.history.map((h) => (
                  <div
                    key={h.id}
                    className="border border-[#DFE5EE] dark:border-[#233349] rounded-lg p-3.5 text-xs space-y-1 bg-[#F8FAFC] dark:bg-[#152236]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#0F233A] dark:text-slate-100">{h.type}</span>
                      <span className="font-mono text-slate-500 dark:text-slate-400">{fmtDate(h.date)}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300">{h.detail}</p>
                    {h.previousIdentifier && (
                      <p className="font-mono text-[#946414] dark:text-amber-300">
                        {biText(locale, 'Preserved ID', 'የተጠበቀ መለያ')}: {h.previousIdentifier} →{' '}
                        {h.newIdentifier}
                      </p>
                    )}
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {biText(locale, 'Actor', 'ፈጻሚ')}: {h.actor} · {biText(locale, 'Evidence', 'ማስረጃ')}:{' '}
                      {h.evidenceRef}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SlideDrawer>

      {/* Add Property Modal */}
      <Modal
        open={createPropOpen}
        onClose={() => setCreatePropOpen(false)}
        title={biText(locale, 'Register Synthetic Property', 'ሰው-ሠራሽ ንብረት መዝግብ')}
        subtitle={biText(
          locale,
          `Scoped strictly to ${activeOwner.name}`,
          `ለ ${activeOwner.name} ብቻ የተለየ`
        )}
      >
        <form onSubmit={handleCreateProp} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
              {biText(locale, 'Property Name *', 'የንብረት ስም *')}
            </label>
            <input
              required
              value={propForm.name}
              onChange={(e) => setPropForm({ ...propForm, name: e.target.value })}
              placeholder="e.g. DEMO Property Gamma"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Code *', 'ኮድ *')}
              </label>
              <input
                required
                value={propForm.code}
                onChange={(e) => setPropForm({ ...propForm, code: e.target.value })}
                placeholder="DEMO-PROP-G"
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Type', 'ዓይነት')}
              </label>
              <select
                value={propForm.propertyType}
                onChange={(e) =>
                  setPropForm({
                    ...propForm,
                    propertyType: e.target.value as 'Mixed-Use Commercial' | 'Commercial Office',
                  })
                }
                className={inputCls}
              >
                <option value="Commercial Office">Commercial Office</option>
                <option value="Mixed-Use Commercial">Mixed-Use Commercial</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Sub-City Placeholder', 'የክፍለ ከተማ ምትክ')}
              </label>
              <input
                value={propForm.subCity}
                onChange={(e) => setPropForm({ ...propForm, subCity: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Evidence Reference *', 'የማስረጃ ማጣቀሻ *')}
              </label>
              <input
                required
                value={propForm.evidenceRef}
                onChange={(e) => setPropForm({ ...propForm, evidenceRef: e.target.value })}
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>
          <div className="pt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreatePropOpen(false)}
              className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] text-slate-700 dark:text-slate-200"
            >
              {labels.cancel}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold"
            >
              {biText(locale, 'Create Synthetic Property', 'ሰው-ሠራሽ ንብረት ፍጠር')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Unit Modal */}
      <Modal
        open={createUnitOpen}
        onClose={() => setCreateUnitOpen(false)}
        title={biText(locale, 'Add Synthetic Unit', 'ሰው-ሠራሽ ክፍል ጨምር')}
        subtitle={`${biText(locale, 'Added under', 'የሚታከለው በ')} ${ownerBuildings[0]?.name || 'Active Building'}`}
      >
        <form onSubmit={handleCreateUnit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Unit Code *', 'የክፍል ኮድ *')}
              </label>
              <input
                required
                value={unitForm.code}
                onChange={(e) => setUnitForm({ ...unitForm, code: e.target.value })}
                placeholder="e.g. A-202"
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Display Name', 'የመታወቂያ ስም')}
              </label>
              <input
                value={unitForm.name}
                onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                placeholder="SYNTH Unit A-202"
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">{biText(locale, 'Floor', 'ፎቅ')}</label>
              <input
                type="number"
                min={0}
                value={unitForm.floor}
                onChange={(e) => setUnitForm({ ...unitForm, floor: Number(e.target.value) })}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">{biText(locale, 'Area (sqm)', 'ስፋት (ካ.ሜ)')}</label>
              <input
                type="number"
                min={10}
                value={unitForm.areaSqm}
                onChange={(e) => setUnitForm({ ...unitForm, areaSqm: Number(e.target.value) })}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Base Rent (ETB)', 'መሠረታዊ ኪራይ (ብር)')}
              </label>
              <input
                type="number"
                min={1000}
                value={unitForm.baseRentEtb}
                onChange={(e) => setUnitForm({ ...unitForm, baseRentEtb: Number(e.target.value) })}
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Initial Status', 'መጀመሪያ ሁኔታ')}
              </label>
              <select
                value={unitForm.status}
                onChange={(e) => setUnitForm({ ...unitForm, status: e.target.value as UnitStatus })}
                className={inputCls}
              >
                {UNIT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {trStatus(s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Evidence Ref *', 'የማስረጃ ማጣቀሻ *')}
              </label>
              <input
                required
                value={unitForm.evidenceRef}
                onChange={(e) => setUnitForm({ ...unitForm, evidenceRef: e.target.value })}
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>
          <div className="pt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateUnitOpen(false)}
              className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] text-slate-700 dark:text-slate-200"
            >
              {labels.cancel}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold"
            >
              {biText(locale, 'Save Synthetic Unit', 'ሰው-ሠራሽ ክፍል አስቀምጥ')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Unit Renumbering Request Modal */}
      <Modal
        open={Boolean(renumberModalUnit)}
        onClose={() => setRenumberModalUnit(null)}
        title={biText(locale, 'Submit Unit Renumbering Request', 'የክፍል ቁጥር ለውጥ ጥያቄ አቅርብ')}
        subtitle={biText(
          locale,
          'Non-destructive change: old identifier is preserved in unit history and requires maker-checker approval.',
          'ታሪክ የማያጠፋ ለውጥ፡ የቀድሞ መለያ በታሪክ ውስጥ ይጠበቃል እንዲሁም የአዘጋጅ-አጽዳቂ ፍቃድ ይፈልጋል።'
        )}
      >
        {renumberModalUnit && (
          <form onSubmit={handleRenumberSubmit} className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-[#F4F6F9] dark:bg-[#162438] border border-[#DFE5EE] dark:border-[#233349]">
              {biText(locale, 'Current Code', 'የአሁኑ ኮድ')}:{' '}
              <span className="font-mono font-semibold">{renumberModalUnit.code}</span> (
              {renumberModalUnit.name})
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                  {biText(locale, 'Proposed New Code *', 'የቀረበው አዲስ ኮድ *')}
                </label>
                <input
                  required
                  value={renumberForm.newCode}
                  onChange={(e) => setRenumberForm({ ...renumberForm, newCode: e.target.value })}
                  placeholder="e.g. A-202"
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                  {biText(locale, 'Effective Date *', 'ተፈጻሚ ቀን *')}
                </label>
                <input
                  type="date"
                  required
                  value={renumberForm.effectiveDate}
                  onChange={(e) =>
                    setRenumberForm({ ...renumberForm, effectiveDate: e.target.value })
                  }
                  className={`${inputCls} font-mono`}
                />
              </div>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Evidence Reference *', 'የማስረጃ ማጣቀሻ *')}
              </label>
              <input
                required
                value={renumberForm.evidenceRef}
                onChange={(e) => setRenumberForm({ ...renumberForm, evidenceRef: e.target.value })}
                placeholder="EVD-REN-2026-..."
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Justification *', 'ምክንያት *')}
              </label>
              <textarea
                required
                rows={2}
                value={renumberForm.reason}
                onChange={(e) => setRenumberForm({ ...renumberForm, reason: e.target.value })}
                placeholder={biText(locale, 'Explain why renumbering is requested...', 'ቁጥር ለውጡ ለምን እንደተጠየቀ ይግለጹ...')}
                className={inputCls}
              />
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenumberModalUnit(null)}
                className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] text-slate-700 dark:text-slate-200"
              >
                {labels.cancel}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#166549] hover:bg-[#12533B] text-white font-semibold"
              >
                {biText(locale, 'Submit to Approvals Centre', 'ወደ ማጽደቂያ ማዕከል ላክ')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Ownership Change Request Modal */}
      <Modal
        open={Boolean(ownershipModalPropId)}
        onClose={() => setOwnershipModalPropId(null)}
        title={biText(locale, 'Property Ownership Change Request', 'የንብረት ባለቤትነት ለውጥ ጥያቄ')}
        subtitle={biText(
          locale,
          'Requires verified evidence reference and maker-checker approval.',
          'የተረጋገጠ የማስረጃ ማጣቀሻና የአዘጋጅ-አጽዳቂ ውሳኔ ይጠይቃል።'
        )}
      >
        <form onSubmit={handleOwnershipSubmit} className="space-y-3 text-xs">
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-100 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-[#C28A24]" />
            <span>
              {biText(
                locale,
                'Prototype Simulation: Production legal-entity transfers require separately approved title deed evidence, reconciliation, and onboarding controls.',
                'የፕሮቶታይፕ ማስመሰያ፡ እውነተኛ የባለቤትነት ዝውውር ለብቻው የጸደቀ የባለቤትነት ማረጋገጫ ካርታና የሂሳብ ማስታረቅ ይጠይቃል።'
              )}
            </span>
          </div>
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
              {biText(locale, 'Proposed Receiving Entity (Synthetic) *', 'የቀረበው ተቀባይ ተቋም (ሰው-ሠራሽ) *')}
            </label>
            <input
              required
              value={ownershipForm.proposedOwnerName}
              onChange={(e) =>
                setOwnershipForm({ ...ownershipForm, proposedOwnerName: e.target.value })
              }
              placeholder="e.g. Test Owner Holding Placeholder"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Effective Date *', 'ተፈጻሚ ቀን *')}
              </label>
              <input
                type="date"
                required
                value={ownershipForm.effectiveDate}
                onChange={(e) =>
                  setOwnershipForm({ ...ownershipForm, effectiveDate: e.target.value })
                }
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                {biText(locale, 'Evidence Reference *', 'የማስረጃ ማጣቀሻ *')}
              </label>
              <input
                required
                value={ownershipForm.evidenceRef}
                onChange={(e) =>
                  setOwnershipForm({ ...ownershipForm, evidenceRef: e.target.value })
                }
                placeholder="EVD-DEED-SYNTH-..."
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">{biText(locale, 'Reason *', 'ምክንያት *')}</label>
            <textarea
              required
              rows={2}
              value={ownershipForm.reason}
              onChange={(e) => setOwnershipForm({ ...ownershipForm, reason: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOwnershipModalPropId(null)}
              className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] text-slate-700 dark:text-slate-200"
            >
              {labels.cancel}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0F233A] dark:bg-[#166549] text-white font-semibold"
            >
              {biText(locale, 'Submit Request', 'ጥያቄ አቅርብ')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
