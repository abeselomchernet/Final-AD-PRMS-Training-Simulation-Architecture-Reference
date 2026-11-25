import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Building2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { UiLocale, biText } from '../../data/i18n';
import { OwnerId, UnitRecord } from '../../types/prms';

export interface OccupancyMonthPoint {
  month: string;
  occupancyRate: number;
  occupiedUnits: number;
  totalUnits: number;
  vacantUnits: number;
}

interface OccupancyTrendRechartsWidgetProps {
  ownerId: OwnerId;
  ownerName: string;
  units: UnitRecord[];
  locale: UiLocale;
}

const HISTORICAL_OCCUPANCY_RATES: Record<OwnerId, number[]> = {
  // Jun, Jul, Aug, Sep, Oct rates (%)
  'OWN-ALPHA': [67, 67, 67, 67, 67],
  'OWN-BETA': [50, 100, 100, 100, 100],
};

export const OccupancyTrendRechartsWidget: React.FC<OccupancyTrendRechartsWidgetProps> = ({
  ownerId,
  ownerName,
  units,
  locale,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const totalUnits = units.length;
  const occupiedCount = units.filter((u) => u.status === 'Occupied').length;
  const liveOccupancyRate = totalUnits > 0 ? Math.round((occupiedCount / totalUnits) * 100) : 0;

  const data = useMemo<OccupancyMonthPoint[]>(() => {
    const months = [
      biText(locale, 'Jun', 'ሰኔ'),
      biText(locale, 'Jul', 'ሐምሌ'),
      biText(locale, 'Aug', 'ነሐሴ'),
      biText(locale, 'Sep', 'መስከረም'),
      biText(locale, 'Oct', 'ጥቅምት'),
      biText(locale, 'Nov', 'ኅዳር'),
    ];
    const histRates = HISTORICAL_OCCUPANCY_RATES[ownerId] || [67, 67, 67, 67, 67];

    return months.map((month, idx) => {
      const rate = idx < 5 ? histRates[idx] ?? liveOccupancyRate : liveOccupancyRate;
      const occupiedUnits =
        idx === 5
          ? occupiedCount
          : totalUnits > 0
            ? Math.round((rate / 100) * totalUnits)
            : 0;
      const vacantUnits = Math.max(0, totalUnits - occupiedUnits);
      return {
        month,
        occupancyRate: rate,
        occupiedUnits,
        totalUnits,
        vacantUnits,
      };
    });
  }, [ownerId, locale, liveOccupancyRate, occupiedCount, totalUnits]);

  const sixMonthAvg = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.round(data.reduce((s, d) => s + d.occupancyRate, 0) / data.length);
  }, [data]);

  const deltaVsStart = data.length >= 2 ? liveOccupancyRate - data[0].occupancyRate : 0;

  const strokeColor = isDark ? '#248F64' : '#166549';
  const gridStroke = isDark ? '#1E2D42' : '#E2E8F0';
  const axisTickColor = isDark ? '#94A3B8' : '#64748B';
  const refLineColor = isDark ? '#E5B85C' : '#C28A24';

  return (
    <div
      className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-5 min-w-0 flex flex-col justify-between"
      data-testid="recharts-occupancy-widget"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#0F233A] dark:text-slate-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#166549] dark:text-emerald-400 shrink-0" />
            <span>
              {biText(
                locale,
                '6-Month Occupancy Rate Overview (Recharts)',
                'የ6 ወር የክፍሎች መከራየት መጠን (Recharts)'
              )}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {biText(
              locale,
              `Unit performance isolated to ${ownerName}`,
              `ለ ${ownerName} ብቻ የተነጠለ የክፍሎች አፈጻጸም`
            )}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="text-lg font-bold font-mono tabular-nums text-[#0F233A] dark:text-slate-100 leading-tight">
            {liveOccupancyRate}%
          </p>
          <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {occupiedCount}/{totalUnits} {biText(locale, 'units', 'ክፍሎች')}
          </p>
        </div>
      </div>

      {/* Summary Metrics Strip */}
      <div className="grid grid-cols-3 gap-3 py-2.5 px-3 rounded-lg bg-[#F8FAFC] dark:bg-[#152236] border border-[#DFE5EE]/80 dark:border-[#233349] mb-3">
        <div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {biText(locale, 'Current', 'የአሁን')}
          </p>
          <p className="text-sm font-bold font-mono tabular-nums text-[#166549] dark:text-emerald-400">
            {liveOccupancyRate}%
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {biText(locale, '6-Mo Avg', 'የ6 ወር አማካይ')}
          </p>
          <p className="text-sm font-bold font-mono tabular-nums text-[#0F233A] dark:text-slate-100">
            {sixMonthAvg}%
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {biText(locale, '6-Mo Change', 'የ6 ወር ለውጥ')}
          </p>
          <p
            className={`text-sm font-bold font-mono tabular-nums ${
              deltaVsStart >= 0
                ? 'text-[#166549] dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            {deltaVsStart >= 0 ? `+${deltaVsStart}` : deltaVsStart} pp
          </p>
        </div>
      </div>

      {/* Recharts Area Chart */}
      {totalUnits === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-[#233349]">
          {biText(locale, 'No synthetic units registered for this owner.', 'ለዚህ ባለቤት የተመዘገበ ክፍል የለም።')}
        </div>
      ) : (
        <div className="w-full h-[220px]">
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            initialDimension={{ width: 480, height: 220 }}
          >
            <AreaChart data={data} margin={{ top: 14, right: 14, left: -12, bottom: 2 }}>
              <defs>
                <linearGradient id={`occupancyFill-${ownerId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={strokeColor} stopOpacity={isDark ? 0.35 : 0.24} />
                  <stop offset="95%" stopColor={strokeColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
              <XAxis
                dataKey="month"
                axisLine={{ stroke: gridStroke }}
                tickLine={false}
                tick={{ fill: axisTickColor, fontSize: 11 }}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: axisTickColor, fontSize: 11 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const pt = payload[0].payload as OccupancyMonthPoint;
                  return (
                    <div className="rounded-lg border border-[#DFE5EE] dark:border-[#2D405B] bg-white dark:bg-[#0D1D30] px-3 py-2 shadow-md text-[11px]">
                      <p className="font-semibold text-[#0F233A] dark:text-slate-100">{pt.month} 2026</p>
                      <p className="font-mono font-bold tabular-nums text-[#166549] dark:text-emerald-400">
                        {pt.occupancyRate}% {biText(locale, 'Occupied', 'የተከራየ')}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 tabular-nums">
                        {pt.occupiedUnits}/{pt.totalUnits} {biText(locale, 'units occupied', 'ክፍሎች ተከራይተዋል')} ·{' '}
                        {pt.vacantUnits} {biText(locale, 'vacant', 'ክፍት')}
                      </p>
                    </div>
                  );
                }}
              />
              <ReferenceLine
                y={sixMonthAvg}
                stroke={refLineColor}
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="occupancyRate"
                stroke={strokeColor}
                strokeWidth={2.5}
                fill={`url(#occupancyFill-${ownerId})`}
                dot={{ r: 3.5, fill: strokeColor, strokeWidth: 1.5, stroke: isDark ? '#111C2C' : '#FFFFFF' }}
                activeDot={{ r: 5, fill: refLineColor, stroke: strokeColor, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-[#233349] text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#166549] dark:bg-[#248F64]" />
            {biText(locale, 'Monthly Occupancy %', 'ወርሃዊ መከራየት %')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-[#C28A24] dark:bg-[#E5B85C]" />
            {biText(locale, `6-Mo Avg (${sixMonthAvg}%)`, `አማካይ (${sixMonthAvg}%)`)}
          </span>
        </div>
        <span className="font-mono tabular-nums">
          {units.filter((u) => u.status === 'Vacant').length} {biText(locale, 'vacant now', 'አሁን ክፍት')}
        </span>
      </div>
    </div>
  );
};
