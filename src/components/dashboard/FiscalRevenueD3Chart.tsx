import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { BarChart3 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { UiLocale, biText } from '../../data/i18n';
import { OwnerId, PaymentReceipt } from '../../types/prms';

export interface FiscalMonthDatum {
  monthKey: string; // e.g. '2026-01'
  monthIndex: number;
  labelEn: string;
  labelAm: string;
  collectedEtb: number;
  receiptCount: number;
  isLiveMonth: boolean;
  isCurrentFiscalMonth: boolean;
}

interface FiscalRevenueD3ChartProps {
  ownerId: OwnerId;
  ownerName: string;
  receipts: PaymentReceipt[];
  locale: UiLocale;
  fmtEtb: (val: number) => string;
  fmtShortEtb: (val: number) => string;
  fiscalYear?: number;
}

const FISCAL_MONTHS: { num: string; en: string; am: string }[] = [
  { num: '01', en: 'Jan', am: 'ጥር' },
  { num: '02', en: 'Feb', am: 'የካ' },
  { num: '03', en: 'Mar', am: 'መጋ' },
  { num: '04', en: 'Apr', am: 'ሚያ' },
  { num: '05', en: 'May', am: 'ግን' },
  { num: '06', en: 'Jun', am: 'ሰኔ' },
  { num: '07', en: 'Jul', am: 'ሐም' },
  { num: '08', en: 'Aug', am: 'ነሐ' },
  { num: '09', en: 'Sep', am: 'መስ' },
  { num: '10', en: 'Oct', am: 'ጥቅ' },
  { num: '11', en: 'Nov', am: 'ኅዳ' },
  { num: '12', en: 'Dec', am: 'ታኅ' },
];

// Synthetic Jan-Sep historical fiscal year collection baselines per owner
// (Oct onward aggregates live active receipts from ownerReceipts so new collections reflect immediately)
const SYNTHETIC_HISTORICAL_BY_OWNER: Record<OwnerId, Record<string, { amount: number; count: number }>> = {
  'OWN-ALPHA': {
    '01': { amount: 74000, count: 3 },
    '02': { amount: 77000, count: 3 },
    '03': { amount: 77000, count: 3 },
    '04': { amount: 72000, count: 3 },
    '05': { amount: 77000, count: 3 },
    '06': { amount: 77000, count: 3 },
    '07': { amount: 77000, count: 3 },
    '08': { amount: 64000, count: 2 }, // Kiremt seasonal dip
    '09': { amount: 79000, count: 3 }, // Meskerem post-holiday settlement
  },
  'OWN-BETA': {
    '01': { amount: 34000, count: 2 },
    '02': { amount: 38000, count: 2 },
    '03': { amount: 38000, count: 2 },
    '04': { amount: 36000, count: 2 },
    '05': { amount: 38000, count: 2 },
    '06': { amount: 38000, count: 2 },
    '07': { amount: 38000, count: 2 },
    '08': { amount: 31000, count: 2 }, // Kiremt seasonal dip
    '09': { amount: 38000, count: 2 },
  },
};

export const FiscalRevenueD3Chart: React.FC<FiscalRevenueD3ChartProps> = ({
  ownerId,
  ownerName,
  receipts,
  locale,
  fmtEtb,
  fmtShortEtb,
  fiscalYear = 2026,
}) => {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [chartWidth, setChartWidth] = useState<number>(620);
  const [dataMode, setDataMode] = useState<'seasonal' | 'liveOnly'>('seasonal');
  const [hovered, setHovered] = useState<{
    datum: FiscalMonthDatum;
    x: number;
    y: number;
  } | null>(null);

  const monthlyData = useMemo<FiscalMonthDatum[]>(() => {
    const activeReceipts = receipts.filter((r) => r.documentState !== 'Reversed');
    const liveByMonth = new Map<string, { total: number; count: number }>();

    for (const r of activeReceipts) {
      const monthKey = r.paymentDate.slice(0, 7);
      const current = liveByMonth.get(monthKey) || { total: 0, count: 0 };
      current.total += r.amountEtb;
      current.count += 1;
      liveByMonth.set(monthKey, current);
    }

    const hist = SYNTHETIC_HISTORICAL_BY_OWNER[ownerId] || {};

    return FISCAL_MONTHS.map((m, idx) => {
      const monthKey = `${fiscalYear}-${m.num}`;
      const live = liveByMonth.get(monthKey);
      const historical = dataMode === 'seasonal' ? hist[m.num] : undefined;

      const collectedEtb = (historical?.amount || 0) + (live?.total || 0);
      const receiptCount = (historical?.count || 0) + (live?.count || 0);

      return {
        monthKey,
        monthIndex: idx,
        labelEn: m.en,
        labelAm: m.am,
        collectedEtb,
        receiptCount,
        isLiveMonth: Boolean(live && live.total > 0),
        isCurrentFiscalMonth: m.num === '11',
      };
    });
  }, [receipts, ownerId, fiscalYear, dataMode]);

  const summary = useMemo(() => {
    const total = monthlyData.reduce((s, d) => s + d.collectedEtb, 0);
    const activeMonths = monthlyData.filter((d) => d.collectedEtb > 0);
    const average = activeMonths.length > 0 ? total / activeMonths.length : 0;
    const peak = monthlyData.reduce(
      (best, cur) => (cur.collectedEtb > best.collectedEtb ? cur : best),
      monthlyData[0]
    );
    return { total, average, peak, activeMonthCount: activeMonths.length };
  }, [monthlyData]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const updateWidth = () => {
      const next = Math.max(320, Math.floor(el.getBoundingClientRect().width));
      if (next > 0) setChartWidth(next);
    };
    updateWidth();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const next = Math.max(320, Math.floor(entry.contentRect.width));
        if (next > 0) setChartWidth(next);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const height = 240;
    const margin = { top: 18, right: 16, bottom: 30, left: 48 };
    const innerWidth = Math.max(200, chartWidth - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    const isDark = theme === 'dark';
    const axisColor = isDark ? '#94A3B8' : '#64748B';
    const gridColor = isDark ? '#1E2D42' : '#E2E8F0';
    const barColor = isDark ? '#248F64' : '#166549';
    const peakColor = isDark ? '#E5B85C' : '#C28A24';
    const emptyBarColor = isDark ? '#1E2D42' : '#E2E8F0';
    const avgLineColor = isDark ? '#E5B85C' : '#C28A24';

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${chartWidth} ${height}`).attr('width', chartWidth).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const labels = monthlyData.map((d) => (locale === 'am' ? d.labelAm : d.labelEn));
    const maxVal = Math.max(d3.max(monthlyData, (d) => d.collectedEtb) || 0, 10000);

    const x = d3.scaleBand<string>().domain(labels).range([0, innerWidth]).padding(0.28);
    const y = d3.scaleLinear().domain([0, maxVal * 1.12]).nice().range([innerHeight, 0]);

    // Horizontal gridlines
    const yTicks = y.ticks(4);
    g.append('g')
      .attr('class', 'd3-gridlines')
      .selectAll('line')
      .data(yTicks)
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .attr('stroke', gridColor)
      .attr('stroke-dasharray', '3,3');

    // Y axis
    const yAxis = d3
      .axisLeft(y)
      .ticks(4)
      .tickSize(0)
      .tickPadding(8)
      .tickFormat((val) => {
        const n = Number(val);
        if (n === 0) return '0';
        if (n >= 1000) return `${Math.round(n / 1000)}k`;
        return String(n);
      });

    const yAxisGroup = g.append('g').call(yAxis);
    yAxisGroup.select('.domain').remove();
    yAxisGroup
      .selectAll('text')
      .attr('fill', axisColor)
      .style('font-size', '11px')
      .style('font-family', 'JetBrains Mono, ui-monospace, monospace');

    // X axis
    const xAxis = d3.axisBottom(x).tickSize(0).tickPadding(10);
    const xAxisGroup = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);
    xAxisGroup.select('.domain').attr('stroke', gridColor);
    xAxisGroup
      .selectAll('text')
      .attr('fill', axisColor)
      .style('font-size', '11px')
      .style('font-weight', '500');

    // Average reference line
    if (summary.average > 0) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', y(summary.average))
        .attr('y2', y(summary.average))
        .attr('stroke', avgLineColor)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,4')
        .attr('opacity', 0.8);
    }

    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const peakKey = summary.peak?.collectedEtb > 0 ? summary.peak.monthKey : '';

    // Bars
    const bars = g
      .selectAll<SVGRectElement, FiscalMonthDatum>('rect.d3-revenue-bar')
      .data(monthlyData, (d) => d.monthKey)
      .join('rect')
      .attr('class', 'd3-revenue-bar')
      .attr('x', (d) => x(locale === 'am' ? d.labelAm : d.labelEn) ?? 0)
      .attr('width', x.bandwidth())
      .attr('rx', 4)
      .attr('tabindex', 0)
      .attr('role', 'img')
      .attr('aria-label', (d) => `${d.labelEn} ${fiscalYear}: ${fmtEtb(d.collectedEtb)}`)
      .attr('fill', (d) => {
        if (d.collectedEtb <= 0) return emptyBarColor;
        return d.monthKey === peakKey ? peakColor : barColor;
      })
      .style('cursor', 'pointer')
      .on('mouseenter', function (_event, d) {
        const cx = (x(locale === 'am' ? d.labelAm : d.labelEn) ?? 0) + x.bandwidth() / 2 + margin.left;
        const cy = y(d.collectedEtb) + margin.top;
        d3.select(this).attr('opacity', 0.85);
        setHovered({ datum: d, x: cx, y: cy });
      })
      .on('focus', function (_event, d) {
        const cx = (x(locale === 'am' ? d.labelAm : d.labelEn) ?? 0) + x.bandwidth() / 2 + margin.left;
        const cy = y(d.collectedEtb) + margin.top;
        setHovered({ datum: d, x: cx, y: cy });
      })
      .on('mouseleave blur', function () {
        d3.select(this).attr('opacity', 1);
        setHovered(null);
      });

    const canTransition =
      !reducedMotion &&
      typeof d3.transition === 'function' &&
      typeof (bars as unknown as { transition?: unknown }).transition === 'function';

    if (!canTransition) {
      bars
        .attr('y', (d) => (d.collectedEtb > 0 ? y(d.collectedEtb) : innerHeight - 3))
        .attr('height', (d) => (d.collectedEtb > 0 ? Math.max(3, innerHeight - y(d.collectedEtb)) : 3));
    } else {
      bars
        .attr('y', innerHeight)
        .attr('height', 0)
        .transition()
        .duration(360)
        .ease(d3.easeCubicOut)
        .attr('y', (d) => (d.collectedEtb > 0 ? y(d.collectedEtb) : innerHeight - 3))
        .attr('height', (d) => (d.collectedEtb > 0 ? Math.max(3, innerHeight - y(d.collectedEtb)) : 3));
    }
  }, [monthlyData, chartWidth, theme, locale, summary.average, summary.peak, fiscalYear, fmtEtb]);

  return (
    <div
      className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 min-w-0 flex flex-col justify-between"
      data-testid="d3-fiscal-revenue-widget"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#0F233A] dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#166549] dark:text-emerald-400 shrink-0" />
            <span>
              {biText(
                locale,
                `FY ${fiscalYear} Monthly Collected Revenue (D3)`,
                `የ${fiscalYear} በጀት ዓመት ወርሃዊ የተሰበሰበ ገቢ (D3)`
              )}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {biText(
              locale,
              `Seasonal rent collection trend isolated to ${ownerName}`,
              `ለ ${ownerName} ብቻ የተነጠለ ወቅታዊ የኪራይ አሰባሰብ ሂደት`
            )}
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-[#DFE5EE] dark:border-[#233349] p-0.5 bg-[#F8FAFC] dark:bg-[#152236] shrink-0">
          <button
            type="button"
            onClick={() => setDataMode('seasonal')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
              dataMode === 'seasonal'
                ? 'bg-white dark:bg-[#0D1D30] text-[#0F233A] dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {biText(locale, 'FY Seasonal + Live', 'ዓመታዊ + ቀጥታ')}
          </button>
          <button
            type="button"
            onClick={() => setDataMode('liveOnly')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
              dataMode === 'liveOnly'
                ? 'bg-white dark:bg-[#0D1D30] text-[#0F233A] dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {biText(locale, 'Live Receipts Only', 'ቀጥታ ደረሰኞች ብቻ')}
          </button>
        </div>
      </div>

      {/* KPI Summary Strip inside widget */}
      <div className="grid grid-cols-3 gap-3 py-2.5 px-3 rounded-lg bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE]/80 dark:border-[#233349] mb-3">
        <div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {biText(locale, 'FY Total', 'ጠቅላላ ገቢ')}
          </p>
          <p className="text-sm font-bold font-mono tabular-nums text-[#0F233A] dark:text-slate-100">
            {fmtShortEtb(summary.total)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {biText(locale, 'Monthly Avg', 'ወርሃዊ አማካይ')}
          </p>
          <p className="text-sm font-bold font-mono tabular-nums text-[#166549] dark:text-emerald-400">
            {fmtShortEtb(Math.round(summary.average))}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {biText(locale, 'Peak Month', 'ከፍተኛ ወር')}
          </p>
          <p className="text-sm font-bold font-mono tabular-nums text-[#C28A24] dark:text-[#E5B85C]">
            {summary.peak && summary.peak.collectedEtb > 0
              ? `${locale === 'am' ? summary.peak.labelAm : summary.peak.labelEn} · ${fmtShortEtb(summary.peak.collectedEtb)}`
              : '—'}
          </p>
        </div>
      </div>

      {/* D3 Chart Canvas */}
      <div ref={containerRef} className="relative w-full overflow-hidden">
        <svg
          ref={svgRef}
          data-testid="d3-fiscal-revenue-svg"
          className="w-full h-[240px] block select-none"
          aria-label={biText(
            locale,
            `FY ${fiscalYear} monthly collected revenue bar chart for ${ownerName}`,
            `የ${fiscalYear} ወርሃዊ የተሰበሰበ ገቢ ግራፍ ለ ${ownerName}`
          )}
        />

        {hovered && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-[#DFE5EE] dark:border-[#2D405B] bg-white dark:bg-[#0D1D30] px-2.5 py-1.5 shadow-md text-[11px] whitespace-nowrap"
            style={{
              left: `${Math.min(Math.max(hovered.x, 70), chartWidth - 70)}px`,
              top: `${Math.max(hovered.y - 8, 42)}px`,
            }}
          >
            <p className="font-semibold text-[#0F233A] dark:text-slate-100">
              {locale === 'am' ? hovered.datum.labelAm : hovered.datum.labelEn} {fiscalYear}
            </p>
            <p className="font-mono font-bold tabular-nums text-[#166549] dark:text-emerald-400">
              {fmtEtb(hovered.datum.collectedEtb)}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
              {hovered.datum.receiptCount}{' '}
              {biText(locale, 'receipt(s)', 'ደረሰኝ(ዎች)')}
              {summary.average > 0 && hovered.datum.collectedEtb > 0
                ? ` · ${hovered.datum.collectedEtb >= summary.average ? '+' : ''}${Math.round(
                    ((hovered.datum.collectedEtb - summary.average) / summary.average) * 100
                  )}% vs avg`
                : ''}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-[#233349] text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#166549] dark:bg-[#248F64]" />
            {biText(locale, 'Collected', 'የተሰበሰበ')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#C28A24] dark:bg-[#E5B85C]" />
            {biText(locale, 'Peak / Avg Line', 'ከፍተኛ / አማካይ')}
          </span>
        </div>
        <span className="font-mono tabular-nums">
          {summary.activeMonthCount}/12 {biText(locale, 'months active', 'ንቁ ወራት')}
        </span>
      </div>
    </div>
  );
};
