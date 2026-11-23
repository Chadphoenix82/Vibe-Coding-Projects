import { useMemo, useState } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { formatCurrency, formatPercent } from '../types/budget';

export interface PieSliceDatum {
  id: string;
  label: string;
  value: number;
  color: string;
  target?: number;
  itemCount?: number;
  isCategory?: boolean;
}

interface CircularPieChartProps {
  mode: 'expenses' | 'cashflow';
  onModeChange: (mode: 'expenses' | 'cashflow') => void;
  slices: PieSliceDatum[];
  totalAmount: number;
  monthlyIncome: number;
  selectedSliceId: string | null;
  onSelectSlice: (id: string | null) => void;
  onInspectCategory: (categoryId: string) => void;
  onAddFirstExpense: () => void;
}

interface ComputedSlice extends PieSliceDatum {
  percentage: number;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  path: string;
  labelX: number;
  labelY: number;
  popX: number;
  popY: number;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeDonutArc(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const outerStart = polarToCartesian(cx, cy, outerRadius, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M',
    outerStart.x.toFixed(2),
    outerStart.y.toFixed(2),
    'A',
    outerRadius.toFixed(2),
    outerRadius.toFixed(2),
    0,
    largeArcFlag,
    0,
    outerEnd.x.toFixed(2),
    outerEnd.y.toFixed(2),
    'L',
    innerStart.x.toFixed(2),
    innerStart.y.toFixed(2),
    'A',
    innerRadius.toFixed(2),
    innerRadius.toFixed(2),
    0,
    largeArcFlag,
    1,
    innerEnd.x.toFixed(2),
    innerEnd.y.toFixed(2),
    'Z',
  ].join(' ');
}

export function CircularPieChart({
  mode,
  onModeChange,
  slices,
  totalAmount,
  monthlyIncome,
  selectedSliceId,
  onSelectSlice,
  onInspectCategory,
  onAddFirstExpense,
}: CircularPieChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const nonZeroSlices = useMemo(
    () => slices.filter((slice) => slice.value > 0.001),
    [slices]
  );

  const outerRadius = 130;
  const innerRadius = 78;
  const midRadius = (outerRadius + innerRadius) / 2;

  const computedSlices: ComputedSlice[] = useMemo(() => {
    const cx = 160;
    const cy = 160;
    const sum = nonZeroSlices.reduce((acc, s) => acc + s.value, 0);
    if (sum <= 0) return [];

    let currentAngle = 0;
    return nonZeroSlices.map((slice) => {
      const percentage = (slice.value / sum) * 100;
      const sweep = (slice.value / sum) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sweep;
      const midAngle = startAngle + sweep / 2;
      currentAngle = endAngle;

      const labelPos = polarToCartesian(cx, cy, midRadius, midAngle);
      const popOffset = 7;
      const popRad = ((midAngle - 90) * Math.PI) / 180;
      const popX = Math.cos(popRad) * popOffset;
      const popY = Math.sin(popRad) * popOffset;

      return {
        ...slice,
        percentage,
        startAngle,
        endAngle,
        midAngle,
        path:
          sweep >= 359.99
            ? ''
            : describeDonutArc(cx, cy, outerRadius, innerRadius, startAngle, endAngle),
        labelX: labelPos.x,
        labelY: labelPos.y,
        popX,
        popY,
      };
    });
  }, [nonZeroSlices, midRadius]);

  const activeId = hoveredId ?? selectedSliceId;
  const activeSlice = computedSlices.find((s) => s.id === activeId) ?? null;

  return (
    <section
      aria-label="Spending distribution donut chart"
      className="bg-white border border-[#D4E7F7] rounded-xl p-6 flex flex-col justify-between"
    >
      {/* Header & Mode Switch */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[#E6F1FA]">
        <div>
          <h2 className="text-lg font-semibold text-[#0F2537] tracking-tight">
            {mode === 'expenses' ? 'Expense Distribution' : 'Monthly Income Allocation'}
          </h2>
          <p className="text-sm text-[#4B6780] mt-0.5">
            {mode === 'expenses'
              ? 'Hover or click any donut segment to inspect category spending.'
              : 'How your monthly income splits across expenses, savings goals, and remaining cash.'}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Donut chart view"
          className="inline-flex items-center p-1 bg-[#EBF5FD] rounded-lg border border-[#D4E7F7] shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'expenses'}
            onClick={() => {
              onModeChange('expenses');
              onSelectSlice(null);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'expenses'
                ? 'bg-white text-[#0C4A6E] shadow-xs'
                : 'text-[#4B6780] hover:text-[#0F2537]'
            }`}
          >
            Expenses
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'cashflow'}
            onClick={() => {
              onModeChange('cashflow');
              onSelectSlice(null);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'cashflow'
                ? 'bg-white text-[#0C4A6E] shadow-xs'
                : 'text-[#4B6780] hover:text-[#0F2537]'
            }`}
          >
            Income Split
          </button>
        </div>
      </div>

      {/* Main Chart + Legend Split */}
      {computedSlices.length === 0 ? (
        <div className="py-14 flex flex-col items-center justify-center text-center">
          <div className="relative w-48 h-48 flex items-center justify-center">
            <svg viewBox="0 0 200 200" className="w-48 h-48" aria-hidden="true">
              <circle
                cx="100"
                cy="100"
                r="76"
                fill="none"
                stroke="#D4E7F7"
                strokeWidth="28"
                strokeDasharray="6 6"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
              <span className="font-mono tabular-nums text-lg font-semibold text-[#0F2537]">
                $0.00
              </span>
              <span className="text-xs text-[#4B6780] mt-0.5">
                {mode === 'expenses' ? 'No expenses yet' : 'No monthly data'}
              </span>
            </div>
          </div>
          <p className="text-sm text-[#4B6780] mt-5 max-w-xs">
            Add your first expense to calculate your spending breakdown across Utilities, Food, Study Materials, and Gaming.
          </p>
          <button
            type="button"
            onClick={onAddFirstExpense}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add First Expense
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,300px)_1fr] gap-6 items-center py-6">
          {/* Interactive Donut SVG with Dynamic Center Readout */}
          <div className="relative flex items-center justify-center">
            <svg
              viewBox="0 0 320 320"
              className="w-full max-w-[292px] h-auto overflow-visible select-none"
              role="img"
              aria-label={`Donut chart totaling ${formatCurrency(totalAmount)} per month`}
            >
              {/* Soft outer halo ring */}
              <circle
                cx="160"
                cy="160"
                r="142"
                fill="#F5FAFF"
                stroke="#E0EFFA"
                strokeWidth="1"
              />

              {/* Crisp center donut hole backdrop */}
              <circle cx="160" cy="160" r={innerRadius - 1} fill="#FFFFFF" />

              {computedSlices.length === 1 ? (
                <g
                  onMouseEnter={() => setHoveredId(computedSlices[0].id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() =>
                    onSelectSlice(
                      selectedSliceId === computedSlices[0].id ? null : computedSlices[0].id
                    )
                  }
                  className="cursor-pointer"
                >
                  <circle
                    cx="160"
                    cy="160"
                    r={midRadius}
                    fill="none"
                    stroke={computedSlices[0].color}
                    strokeWidth={outerRadius - innerRadius}
                  />
                  <text
                    x="160"
                    y={160 - midRadius + 4}
                    textAnchor="middle"
                    className="fill-white font-mono text-[11px] font-semibold pointer-events-none"
                  >
                    100%
                  </text>
                </g>
              ) : (
                computedSlices.map((slice) => {
                  const isActive = activeId === slice.id;
                  const isDimmed = activeId !== null && !isActive;

                  return (
                    <g
                      key={slice.id}
                      style={{
                        transform: isActive
                          ? `translate(${slice.popX.toFixed(1)}px, ${slice.popY.toFixed(1)}px)`
                          : 'translate(0px, 0px)',
                        opacity: isDimmed ? 0.45 : 1,
                        transition:
                          'transform 180ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease',
                      }}
                      onMouseEnter={() => setHoveredId(slice.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() =>
                        onSelectSlice(selectedSliceId === slice.id ? null : slice.id)
                      }
                      className="cursor-pointer focus:outline-none"
                      tabIndex={0}
                      role="button"
                      aria-label={`${slice.label}: ${formatCurrency(slice.value)} per month (${formatPercent(slice.percentage)})`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectSlice(selectedSliceId === slice.id ? null : slice.id);
                        }
                      }}
                    >
                      <path
                        d={slice.path}
                        fill={slice.color}
                        stroke="#FFFFFF"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />
                      {slice.percentage >= 7 && (
                        <text
                          x={slice.labelX}
                          y={slice.labelY + 4}
                          textAnchor="middle"
                          className="fill-white font-mono text-[11px] font-semibold pointer-events-none"
                        >
                          {Math.round(slice.percentage)}%
                        </text>
                      )}
                    </g>
                  );
                })
              )}
            </svg>

            {/* Center Donut Readout */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-16">
              {activeSlice ? (
                <>
                  <span className="text-[11px] font-medium text-[#4B6780] max-w-[126px] truncate">
                    {activeSlice.label}
                  </span>
                  <span className="font-mono tabular-nums text-lg font-semibold text-[#0F2537] mt-0.5">
                    {formatCurrency(activeSlice.value)}
                  </span>
                  <span className="font-mono tabular-nums text-[11px] text-[#0284C7] font-medium mt-0.5">
                    {formatPercent(activeSlice.percentage)} / mo
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[11px] font-medium text-[#4B6780]">
                    {mode === 'expenses' ? 'Monthly Total' : 'Monthly Split'}
                  </span>
                  <span className="font-mono tabular-nums text-lg font-semibold text-[#0F2537] mt-0.5">
                    {formatCurrency(totalAmount)}
                  </span>
                  <span className="text-[11px] text-[#6B87A1] mt-0.5">
                    {computedSlices.length} {computedSlices.length === 1 ? 'category' : 'categories'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Interactive Legend Table */}
          <div className="divide-y divide-[#EAF3FB]">
            {computedSlices.map((slice) => {
              const isActive = activeId === slice.id;
              return (
                <button
                  key={slice.id}
                  type="button"
                  onMouseEnter={() => setHoveredId(slice.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() =>
                    onSelectSlice(selectedSliceId === slice.id ? null : slice.id)
                  }
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left rounded-lg transition-colors cursor-pointer ${
                    isActive ? 'bg-[#EBF5FD]' : 'hover:bg-[#F5FAFF]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-3 h-3 rounded-[3px] shrink-0"
                      style={{ backgroundColor: slice.color }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#0F2537] truncate">
                        {slice.label}
                      </div>
                      <div className="text-xs text-[#4B6780]">
                        {slice.itemCount !== undefined
                          ? `${slice.itemCount} ${slice.itemCount === 1 ? 'item' : 'items'}`
                          : 'Monthly allocation'}
                        {slice.target && slice.target > 0 ? (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span className="font-mono tabular-nums">
                              Goal {formatCurrency(slice.target)}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono tabular-nums text-sm font-semibold text-[#0F2537]">
                      {formatCurrency(slice.value)}
                    </div>
                    <div className="font-mono tabular-nums text-xs text-[#4B6780]">
                      {formatPercent(slice.percentage)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected / Hovered Slice Detail Strip */}
      <div className="pt-4 border-t border-[#E6F1FA] min-h-[52px] flex flex-wrap items-center justify-between gap-3">
        {activeSlice ? (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span
                className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                style={{ backgroundColor: activeSlice.color }}
                aria-hidden="true"
              />
              <span className="font-semibold text-[#0F2537]">{activeSlice.label}</span>
              <span className="text-[#94B4CE]" aria-hidden="true">/</span>
              <span className="font-mono tabular-nums text-[#0F2537]">
                {formatCurrency(activeSlice.value)}/mo
              </span>
              <span className="text-[#94B4CE]" aria-hidden="true">·</span>
              <span className="text-xs text-[#4B6780]">
                {formatPercent(activeSlice.percentage)} of chart
                {monthlyIncome > 0
                  ? ` · ${formatPercent((activeSlice.value / monthlyIncome) * 100)} of income`
                  : ''}
              </span>
            </div>

            {activeSlice.isCategory && (
              <button
                type="button"
                onClick={() => onInspectCategory(activeSlice.id)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0284C7] hover:text-[#0369A1] whitespace-nowrap shrink-0 cursor-pointer"
              >
                View {activeSlice.label} items
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        ) : (
          <div className="text-xs text-[#4B6780]">
            Hover or click any segment in the donut chart to inspect its monthly share and income ratio.
          </div>
        )}
      </div>
    </section>
  );
}
