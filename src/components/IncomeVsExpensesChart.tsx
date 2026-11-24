import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Plus } from 'lucide-react';
import { formatCurrency, formatPercent } from '../types/budget';

interface IncomeVsExpensesChartProps {
  totalMonthlyIncome: number;
  totalMonthlyExpenses: number;
  isDark: boolean;
  onAddIncome: () => void;
  onAddExpense: () => void;
}

interface BarDatum {
  name: string;
  amount: number;
  color: string;
  shareLabel: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: BarDatum }>;
}

function CashFlowTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-white dark:bg-[#0D1C2B] border border-[#CBE2F5] dark:border-[#254A6B] rounded-lg px-3.5 py-2.5 shadow-md text-xs">
      <div className="font-semibold text-[#0F2537] dark:text-[#EDF6FF] flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-[2px] shrink-0"
          style={{ backgroundColor: item.color }}
          aria-hidden="true"
        />
        {item.name}
      </div>
      <div className="font-mono tabular-nums text-sm font-semibold text-[#0C4A6E] dark:text-[#7DD3FC] mt-1">
        {formatCurrency(item.amount)}/mo
      </div>
      <div className="text-[#4B6780] dark:text-[#93B4CF] mt-0.5">{item.shareLabel}</div>
    </div>
  );
}

export function IncomeVsExpensesChart({
  totalMonthlyIncome,
  totalMonthlyExpenses,
  isDark,
  onAddIncome,
  onAddExpense,
}: IncomeVsExpensesChartProps) {
  const netBalance = totalMonthlyIncome - totalMonthlyExpenses;
  const isSurplus = netBalance >= 0;
  const expenseRatio =
    totalMonthlyIncome > 0 ? (totalMonthlyExpenses / totalMonthlyIncome) * 100 : 0;
  const savingsRate =
    totalMonthlyIncome > 0 ? Math.max(0, (netBalance / totalMonthlyIncome) * 100) : 0;

  const incomeColor = isDark ? '#38BDF8' : '#0284C7';
  const expenseColor = isSurplus
    ? isDark
      ? '#818CF8'
      : '#6366F1'
    : isDark
    ? '#FB7185'
    : '#E11D48';

  const data: BarDatum[] = [
    {
      name: 'Monthly Income',
      amount: Number(totalMonthlyIncome.toFixed(2)),
      color: incomeColor,
      shareLabel: `${formatCurrency(totalMonthlyIncome * 12)} annualized`,
    },
    {
      name: 'Monthly Expenses',
      amount: Number(totalMonthlyExpenses.toFixed(2)),
      color: expenseColor,
      shareLabel:
        totalMonthlyIncome > 0
          ? `${formatPercent(expenseRatio)} of monthly income`
          : `${formatCurrency(totalMonthlyExpenses * 12)} annualized`,
    },
  ];

  const hasData = totalMonthlyIncome > 0 || totalMonthlyExpenses > 0;
  const gridColor = isDark ? '#1A3046' : '#E3F0FB';
  const axisColor = isDark ? '#93B4CF' : '#4B6780';
  const labelColor = isDark ? '#EDF6FF' : '#0F2537';

  return (
    <section
      aria-label="Monthly income versus expenses summary"
      className="@container bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#E6F1FA] dark:border-[#1A3046]">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-[#0F2537] dark:text-[#EDF6FF] tracking-tight">
            Monthly Cash Flow Summary
          </h2>
          <p className="text-xs sm:text-sm text-[#4B6780] dark:text-[#93B4CF] mt-0.5">
            Direct comparison of total active monthly income against total monthly expenses.
          </p>
        </div>

        <div className="text-left sm:text-right shrink-0">
          <div className="text-xs text-[#4B6780] dark:text-[#93B4CF]">
            {isSurplus ? 'Monthly Surplus' : 'Monthly Deficit'}
          </div>
          <div
            className={`font-mono tabular-nums text-base sm:text-lg font-semibold ${
              isSurplus
                ? 'text-[#0F766E] dark:text-[#2DD4BF]'
                : 'text-[#BE123C] dark:text-[#FB7185]'
            }`}
          >
            {formatCurrency(netBalance, true)}
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="py-10 text-center">
          <p className="text-sm text-[#4B6780] dark:text-[#93B4CF] max-w-md mx-auto">
            Add at least one income source or expense to compare your monthly cash flow.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={onAddIncome}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#0C4A6E] dark:text-[#7DD3FC] bg-[#E0F2FE] dark:bg-[#163049] hover:bg-[#BAE6FD] dark:hover:bg-[#1E3F5E] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Income
            </button>
            <button
              type="button"
              onClick={onAddExpense}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] dark:bg-[#0EA5E9] dark:text-[#08131E] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Expense
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 @[640px]:grid-cols-[1.4fr_0.9fr] gap-6 items-center pt-5">
          {/* Recharts Bar Chart */}
          <div className="w-full h-[226px] sm:h-[248px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 24, right: 16, left: 0, bottom: 4 }}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis
                  dataKey="name"
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                  tick={{ fill: axisColor, fontSize: 11, fontWeight: 500 }}
                  dy={6}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={58}
                  tick={{ fill: axisColor, fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace' }}
                  tickFormatter={(value: number) =>
                    value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value}`
                  }
                />
                <Tooltip
                  content={<CashFlowTooltip />}
                  cursor={{ fill: isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(2, 132, 199, 0.06)' }}
                />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={92}>
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="amount"
                    position="top"
                    offset={8}
                    formatter={(val) => formatCurrency(Number(val ?? 0))}
                    style={{
                      fill: labelColor,
                      fontSize: '11px',
                      fontWeight: 600,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Numeric Cash Flow Breakdown */}
          <div className="divide-y divide-[#EAF3FB] dark:divide-[#1A3046] border-t @[640px]:border-t-0 @[640px]:border-l border-[#E6F1FA] dark:border-[#1A3046] pt-4 @[640px]:pt-0 @[640px]:pl-6">
            <div className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-medium text-[#4B6780] dark:text-[#93B4CF]">
                <span
                  className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                  style={{ backgroundColor: incomeColor }}
                  aria-hidden="true"
                />
                <span>Total Monthly Income</span>
              </div>
              <span className="font-mono tabular-nums text-sm font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
                {formatCurrency(totalMonthlyIncome)}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-medium text-[#4B6780] dark:text-[#93B4CF]">
                <span
                  className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                  style={{ backgroundColor: expenseColor }}
                  aria-hidden="true"
                />
                <span>Total Monthly Expenses</span>
              </div>
              <span className="font-mono tabular-nums text-sm font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
                {formatCurrency(totalMonthlyExpenses)}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-[#4B6780] dark:text-[#93B4CF]">
                Expense-to-Income Ratio
              </span>
              <span className="font-mono tabular-nums text-sm font-medium text-[#0F2537] dark:text-[#EDF6FF]">
                {totalMonthlyIncome > 0 ? formatPercent(expenseRatio) : '—'}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-[#4B6780] dark:text-[#93B4CF]">
                {isSurplus ? 'Monthly Savings Capacity' : 'Shortfall to Cover'}
              </span>
              <span
                className={`font-mono tabular-nums text-sm font-semibold ${
                  isSurplus
                    ? 'text-[#0F766E] dark:text-[#2DD4BF]'
                    : 'text-[#BE123C] dark:text-[#FB7185]'
                }`}
              >
                {isSurplus
                  ? `${formatCurrency(netBalance)} (${formatPercent(savingsRate)})`
                  : formatCurrency(Math.abs(netBalance))}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
