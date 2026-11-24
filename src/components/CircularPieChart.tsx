import { useMemo, useState } from 'react';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
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
  onClearCategory?: (categoryId: string, categoryName: string) => void;
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

function truncateSvgLabel(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
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
  onClearCategory,
  onAddFirstExpense,
}: CircularPieChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [confirmClearId, setConfirmClearId] = useState<string | null>(null);

  const nonZeroSlices = useMemo(
    () => slices.filter((slice) => slice.value > 0.001),
    [slices]
  );

  const cx = 160;
  const cy = 160;
  const outerRadius = 132;
  const innerRadius = 84;
  const midRadius = (outerRadius + innerRadius) / 2;

  const computedSlices: ComputedSlice[] = useMemo(() => {
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
      const popOffset = 6;
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

  const centerHeading = activeSlice
    ? truncateSvgLabel(activeSlice.label, 17)
    : mode === 'expenses'
    ? 'Monthly Total'
    : 'Monthly Split';

  const centerAmountStr = formatCurrency(activeSlice ? activeSlice.value : totalAmount);
  const centerAmountFontSize =
    centerAmountStr.length >= 11 ? 14 : centerAmountStr.length >= 9 ? 16 : 18;

  const centerSubtext = activeSlice
    ? `${formatPercent(activeSlice.percentage)} / mo`
    : `${computedSlices.length} ${computedSlices.length === 1 ? 'category' : 'categories'}`;

  return (
    <section
      aria-label="Spending distribution donut chart"
      className="@container bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl p-5 sm:p-6 flex flex-col justify-between"
    >
      {/* Header & Mode Switch */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#E6F1FA] dark:border-[#1A3046]">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-[#0F2537] dark:text-[#EDF6FF] tracking-tight">
            {mode === 'expenses' ? 'Expense Distribution' : 'Monthly Income Allocation'}
          </h2>
          <p className="text-xs sm:text-sm text-[#4B6780] dark:text-[#93B4CF] mt-0.5">
            {mode === 'expenses'
              ? 'Tap or hover any donut segment to inspect category spending.'
              : 'How your monthly income splits across expenses, goals, and free cash.'}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Donut chart view"
          className="inline-flex items-center p-1 bg-[#EBF5FD] dark:bg-[#0B1825] rounded-lg border border-[#D4E7F7] dark:border-[#1E3750] shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'expenses'}
            onClick={() => {
              onModeChange('expenses');
              onSelectSlice(null);
            }}
            className={`min-h-[34px] px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'expenses'
                ? 'bg-white dark:bg-[#183148] text-[#0C4A6E] dark:text-[#7DD3FC] shadow-xs'
                : 'text-[#4B6780] dark:text-[#8FB0CC] hover:text-[#0F2537] dark:hover:text-white'
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
            className={`min-h-[34px] px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'cashflow'
                ? 'bg-white dark:bg-[#183148] text-[#0C4A6E] dark:text-[#7DD3FC] shadow-xs'
                : 'text-[#4B6780] dark:text-[#8FB0CC] hover:text-[#0F2537] dark:hover:text-white'
            }`}
          >
            Income Split
          </button>
        </div>
      </div>

      {/* Main Chart + Legend Split (container-aware so legend never collides with donut) */}
      {computedSlices.length === 0 ? (
        <div className="py-10 sm:py-12 flex flex-col items-center justify-center text-center">
          <svg
            viewBox="0 0 200 200"
            className="w-40 h-40 sm:w-44 sm:h-44"
            role="img"
            aria-label="Empty donut chart: $0.00"
          >
            <circle
              cx="100"
              cy="100"
              r="76"
              fill="none"
              className="stroke-[#D4E7F7] dark:stroke-[#1E3750]"
              strokeWidth="26"
              strokeDasharray="6 6"
            />
            <text
              x="100"
              y="94"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="16"
              fontWeight="600"
              className="fill-[#0F2537] dark:fill-[#EDF6FF] font-mono"
            >
              $0.00
            </text>
            <text
              x="100"
              y="114"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="10"
              className="fill-[#4B6780] dark:fill-[#93B4CF]"
            >
              {mode === 'expenses' ? 'No expenses yet' : 'No monthly data'}
            </text>
          </svg>
          <p className="text-sm text-[#4B6780] dark:text-[#93B4CF] mt-4 max-w-xs">
            Add your first expense to calculate your spending breakdown across Utilities, Food, Study Materials, and Gaming.
          </p>
          <button
            type="button"
            onClick={onAddFirstExpense}
            className="mt-4 min-h-[44px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] dark:bg-[#0EA5E9] dark:text-[#08131E] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add First Expense
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 @[490px]:grid-cols-[232px_minmax(0,1fr)] gap-5 items-center py-5">
          {/* Interactive Donut SVG with True Centered SVG Text Overlay */}
          <div className="flex items-center justify-center">
            <svg
              viewBox="0 0 320 320"
              className="w-full max-w-[232px] h-auto overflow-visible select-none"
              role="img"
              aria-label={`Donut chart totaling ${formatCurrency(totalAmount)} per month`}
            >
              {/* Soft outer halo ring */}
              <circle
                cx={cx}
                cy={cy}
                r="142"
                className="fill-[#F5FAFF] dark:fill-[#0D1C2B] stroke-[#E0EFFA] dark:stroke-[#1E3750]"
                strokeWidth="1"
              />

              {/* Crisp center donut hole backdrop */}
              <circle
                cx={cx}
                cy={cy}
                r={innerRadius - 1}
                className="fill-white dark:fill-[#112233]"
              />

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
                    cx={cx}
                    cy={cy}
                    r={midRadius}
                    fill="none"
                    stroke={computedSlices[0].color}
                    strokeWidth={outerRadius - innerRadius}
                  />
                  <text
                    x={cx}
                    y={cy - midRadius}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="10"
                    fontWeight="600"
                    className="fill-white font-mono pointer-events-none"
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
                        opacity: isDimmed ? 0.42 : 1,
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
                        className="stroke-white dark:stroke-[#112233]"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />
                      {slice.percentage >= 9 && (
                        <text
                          x={slice.labelX}
                          y={slice.labelY}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize="10"
                          fontWeight="600"
                          className="fill-white font-mono pointer-events-none"
                        >
                          {Math.round(slice.percentage)}%
                        </text>
                      )}
                    </g>
                  );
                })
              )}

              {/* Exact Geometrically Centered Donut Hole Readout */}
              <g className="pointer-events-none">
                <text
                  x={cx}
                  y={cy - 22}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="10.5"
                  fontWeight="500"
                  className="fill-[#4B6780] dark:fill-[#93B4CF]"
                >
                  {centerHeading}
                </text>
                <text
                  x={cx}
                  y={cy + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={centerAmountFontSize}
                  fontWeight="600"
                  className="fill-[#0F2537] dark:fill-[#EDF6FF] font-mono tabular-nums"
                >
                  {centerAmountStr}
                </text>
                <text
                  x={cx}
                  y={cy + 23}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="10"
                  fontWeight="500"
                  className={
                    activeSlice
                      ? 'fill-[#0284C7] dark:fill-[#38BDF8] font-mono tabular-nums'
                      : 'fill-[#6B87A1] dark:fill-[#7496B5]'
                  }
                >
                  {centerSubtext}
                </text>
              </g>
            </svg>
          </div>

          {/* Interactive Legend Table */}
          <div className="divide-y divide-[#EAF3FB] dark:divide-[#1A3046] min-w-0">
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
                  className={`w-full min-h-[44px] flex items-center justify-between gap-3 px-2.5 py-2 text-left rounded-lg transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#EBF5FD] dark:bg-[#173047]'
                      : 'hover:bg-[#F5FAFF] dark:hover:bg-[#142A3E]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span
                      className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                      style={{ backgroundColor: slice.color }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-medium text-[#0F2537] dark:text-[#EDF6FF] truncate">
                        {slice.label}
                      </div>
                      <div className="text-[11px] text-[#4B6780] dark:text-[#93B4CF] truncate">
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
                    <div className="font-mono tabular-nums text-xs sm:text-sm font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
                      {formatCurrency(slice.value)}
                    </div>
                    <div className="font-mono tabular-nums text-[11px] text-[#4B6780] dark:text-[#93B4CF]">
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
      <div className="pt-3.5 border-t border-[#E6F1FA] dark:border-[#1A3046] min-h-[48px] flex flex-wrap items-center justify-between gap-3">
        {activeSlice ? (
          <>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm">
              <span
                className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                style={{ backgroundColor: activeSlice.color }}
                aria-hidden="true"
              />
              <span className="font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
                {activeSlice.label}
              </span>
              <span className="text-[#94B4CE] dark:text-[#456787]" aria-hidden="true">/</span>
              <span className="font-mono tabular-nums text-[#0F2537] dark:text-[#EDF6FF]">
                {formatCurrency(activeSlice.value)}/mo
              </span>
              <span className="text-[#94B4CE] dark:text-[#456787]" aria-hidden="true">·</span>
              <span className="text-xs text-[#4B6780] dark:text-[#93B4CF]">
                {formatPercent(activeSlice.percentage)} of chart
                {monthlyIncome > 0
                  ? ` · ${formatPercent((activeSlice.value / monthlyIncome) * 100)} of income`
                  : ''}
              </span>
            </div>

            {activeSlice.isCategory && (
              <div className="flex items-center gap-3 shrink-0">
                {onClearCategory && (
                  confirmClearId === activeSlice.id ? (
                    <div className="inline-flex items-center gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          onClearCategory(activeSlice.id, activeSlice.label);
                          setConfirmClearId(null);
                          onSelectSlice(null);
                        }}
                        className="min-h-[32px] px-2.5 py-1 font-semibold text-white bg-[#BE123C] hover:bg-[#9F1239] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Confirm Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearId(null)}
                        className="min-h-[32px] px-2 py-1 text-[#4B6780] dark:text-[#93B4CF] hover:text-[#0F2537] dark:hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSlice(activeSlice.id);
                        setConfirmClearId(activeSlice.id);
                      }}
                      className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#BE123C] dark:text-[#FB7185] hover:bg-[#FFF1F2] dark:hover:bg-[#3B1020] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Clear {activeSlice.label}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => onInspectCategory(activeSlice.id)}
                  className="min-h-[36px] inline-flex items-center gap-1.5 text-xs font-medium text-[#0284C7] dark:text-[#38BDF8] hover:text-[#0369A1] dark:hover:text-[#7DD3FC] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  View items
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-[#4B6780] dark:text-[#93B4CF]">
            Tap or hover any segment in the donut chart to inspect its monthly share and income ratio.
          </div>
        )}
      </div>
    </section>
  );
}
