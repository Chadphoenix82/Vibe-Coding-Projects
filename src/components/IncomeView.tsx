import { useMemo } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  FREQUENCY_META,
  INCOME_SOURCE_LABELS,
  IncomeItem,
  formatCurrency,
  formatPercent,
  toMonthlyAmount,
} from '../types/budget';

interface IncomeViewProps {
  incomes: IncomeItem[];
  monthlyExpenses: number;
  onAddIncome: () => void;
  onEditIncome: (income: IncomeItem) => void;
  onToggleActive: (id: string) => void;
  onDeleteIncome: (id: string) => void;
}

const SOURCE_BAR_COLORS = ['#0369A1', '#0EA5E9', '#14B8A6', '#6366F1', '#06B6D4', '#2563EB'];

export function IncomeView({
  incomes,
  monthlyExpenses,
  onAddIncome,
  onEditIncome,
  onToggleActive,
  onDeleteIncome,
}: IncomeViewProps) {
  const activeIncomes = useMemo(() => incomes.filter((i) => i.active), [incomes]);

  const totalMonthlyIncome = useMemo(
    () => activeIncomes.reduce((sum, item) => sum + toMonthlyAmount(item.amount, item.frequency), 0),
    [activeIncomes]
  );

  const weeklyEquivalent = (totalMonthlyIncome * 12) / 52;
  const annualEquivalent = totalMonthlyIncome * 12;
  const coverageRatio =
    monthlyExpenses > 0 ? (totalMonthlyIncome / monthlyExpenses) * 100 : totalMonthlyIncome > 0 ? 100 : 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* 4-Column Income KPI Strip */}
      <div className="grid grid-cols-2 min-[840px]:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl p-4 sm:p-5 min-w-0">
          <div className="text-xs font-medium text-[#4B6780] dark:text-[#93B4CF] truncate">
            Active Monthly Income
          </div>
          <div className="font-mono tabular-nums text-base sm:text-xl font-semibold text-[#0F2537] dark:text-[#EDF6FF] mt-1 tracking-tight truncate">
            {formatCurrency(totalMonthlyIncome)}
          </div>
          <div className="text-[11px] sm:text-xs text-[#4B6780] dark:text-[#93B4CF] mt-1.5">
            {activeIncomes.length} of {incomes.length} active
          </div>
        </div>

        <div className="bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl p-4 sm:p-5 min-w-0">
          <div className="text-xs font-medium text-[#4B6780] dark:text-[#93B4CF] truncate">
            Weekly Equivalent
          </div>
          <div className="font-mono tabular-nums text-base sm:text-xl font-semibold text-[#0F2537] dark:text-[#EDF6FF] mt-1 tracking-tight truncate">
            {formatCurrency(weeklyEquivalent)}
          </div>
          <div className="text-[11px] sm:text-xs text-[#4B6780] dark:text-[#93B4CF] mt-1.5">
            52-week average
          </div>
        </div>

        <div className="bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl p-4 sm:p-5 min-w-0">
          <div className="text-xs font-medium text-[#4B6780] dark:text-[#93B4CF] truncate">
            Annualized Income
          </div>
          <div className="font-mono tabular-nums text-base sm:text-xl font-semibold text-[#0F2537] dark:text-[#EDF6FF] mt-1 tracking-tight truncate">
            {formatCurrency(annualEquivalent)}
          </div>
          <div className="text-[11px] sm:text-xs text-[#4B6780] dark:text-[#93B4CF] mt-1.5">
            12-month run rate
          </div>
        </div>

        <div className="bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl p-4 sm:p-5 min-w-0">
          <div className="text-xs font-medium text-[#4B6780] dark:text-[#93B4CF] truncate">
            Expense Coverage
          </div>
          <div
            className={`font-mono tabular-nums text-base sm:text-xl font-semibold mt-1 tracking-tight truncate ${
              totalMonthlyIncome >= monthlyExpenses
                ? 'text-[#0F766E] dark:text-[#2DD4BF]'
                : 'text-[#BE123C] dark:text-[#FB7185]'
            }`}
          >
            {formatPercent(coverageRatio)}
          </div>
          <div className="text-[11px] sm:text-xs text-[#4B6780] dark:text-[#93B4CF] mt-1.5">
            {totalMonthlyIncome >= monthlyExpenses ? 'Covers expenses' : 'Below expenses'}
          </div>
        </div>
      </div>

      {/* Stacked Income Share Visualization */}
      {activeIncomes.length > 0 && totalMonthlyIncome > 0 && (
        <section className="bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
                Income Mix by Source
              </h2>
              <p className="text-xs text-[#4B6780] dark:text-[#93B4CF] mt-0.5">
                Proportional contribution of each active income stream to your monthly budget.
              </p>
            </div>
            <span className="font-mono tabular-nums text-sm font-semibold text-[#0C4A6E] dark:text-[#38BDF8]">
              {formatCurrency(totalMonthlyIncome)}/mo
            </span>
          </div>

          <div className="h-4 w-full bg-[#EAF4FC] dark:bg-[#193047] rounded-full overflow-hidden flex gap-0.5">
            {activeIncomes.map((item, idx) => {
              const monthly = toMonthlyAmount(item.amount, item.frequency);
              const pct = (monthly / totalMonthlyIncome) * 100;
              return (
                <div
                  key={item.id}
                  title={`${item.title}: ${formatCurrency(monthly)}/mo (${formatPercent(pct)})`}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: SOURCE_BAR_COLORS[idx % SOURCE_BAR_COLORS.length],
                  }}
                  className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-200"
                />
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            {activeIncomes.map((item, idx) => {
              const monthly = toMonthlyAmount(item.amount, item.frequency);
              const pct = (monthly / totalMonthlyIncome) * 100;
              return (
                <div key={item.id} className="inline-flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                    style={{ backgroundColor: SOURCE_BAR_COLORS[idx % SOURCE_BAR_COLORS.length] }}
                    aria-hidden="true"
                  />
                  <span className="font-medium text-[#0F2537] dark:text-[#EDF6FF]">{item.title}</span>
                  <span className="font-mono tabular-nums text-[#4B6780] dark:text-[#93B4CF]">
                    {formatPercent(pct)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Income Sources Table */}
      <section className="bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl overflow-hidden">
        <div className="px-5 sm:px-6 py-4 bg-[#F5FAFF] dark:bg-[#0D1C2B] border-b border-[#D4E7F7] dark:border-[#1E3750] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
              All Income Sources
            </h2>
            <p className="text-xs text-[#4B6780] dark:text-[#93B4CF] mt-0.5">
              Add part-time jobs, parental support, scholarships, or freelance work with any pay cadence.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddIncome}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] dark:bg-[#0EA5E9] dark:text-[#08131E] dark:hover:bg-[#38BDF8] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Income Source
          </button>
        </div>

        {incomes.length === 0 ? (
          <div className="p-12 text-center">
            <h3 className="text-sm font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
              No income sources recorded
            </h3>
            <p className="text-xs text-[#4B6780] dark:text-[#93B4CF] mt-1 max-w-md mx-auto">
              Add your part-time job, family support, scholarship stipend, or tutoring income to calculate your monthly net balance.
            </p>
            <button
              type="button"
              onClick={onAddIncome}
              className="mt-4 min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] dark:bg-[#0EA5E9] dark:text-[#08131E] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add First Income Source
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E3F0FB] dark:border-[#1A3046] text-xs font-medium text-[#4B6780] dark:text-[#93B4CF] bg-[#FAFDFE] dark:bg-[#0E1E2E]">
                  <th className="py-3 pl-5 sm:pl-6 pr-3">Source</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Schedule</th>
                  <th className="py-3 px-3 text-right">Monthly</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 pl-3 pr-5 sm:pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAF3FB] dark:divide-[#1A3046] text-sm">
                {incomes.map((item) => {
                  const monthly = toMonthlyAmount(item.amount, item.frequency);
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-[#F5FAFF] dark:hover:bg-[#152B40] transition-colors ${
                        item.active ? '' : 'opacity-60'
                      }`}
                    >
                      <td className="py-3.5 pl-5 sm:pl-6 pr-3 max-w-[240px]">
                        <div className="font-medium text-[#0F2537] dark:text-[#EDF6FF] truncate">
                          {item.title}
                        </div>
                        {item.note && (
                          <div className="text-xs text-[#607D96] dark:text-[#7496B5] mt-0.5 truncate">
                            {item.note}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap text-xs text-[#33516B] dark:text-[#B8D2E8]">
                        {INCOME_SOURCE_LABELS[item.sourceType]}
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="font-mono tabular-nums text-[#0F2537] dark:text-[#EDF6FF]">
                          {formatCurrency(item.amount)}
                        </span>{' '}
                        <span className="text-xs text-[#607D96] dark:text-[#7496B5]">
                          {FREQUENCY_META[item.frequency].label}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono tabular-nums font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
                        {formatCurrency(monthly)}
                      </td>

                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onToggleActive(item.id)}
                          className={`min-h-[34px] px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            item.active
                              ? 'text-[#0F766E] dark:text-[#2DD4BF] bg-[#ECFEFF] dark:bg-[#0D3038] hover:bg-[#CFFAFE] dark:hover:bg-[#13424D]'
                              : 'text-[#607D96] dark:text-[#93B4CF] bg-[#EFF6FC] dark:bg-[#182E44] hover:bg-[#E1EFFB] dark:hover:bg-[#203D5A]'
                          }`}
                        >
                          {item.active ? 'Active' : 'Paused'}
                        </button>
                      </td>

                      <td className="py-3.5 pl-3 pr-5 sm:pr-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditIncome(item)}
                            aria-label={`Edit ${item.title}`}
                            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-[#4B6780] dark:text-[#93B4CF] hover:text-[#0284C7] dark:hover:text-[#38BDF8] hover:bg-[#E1F0FC] dark:hover:bg-[#19334C] rounded-md transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteIncome(item.id)}
                            aria-label={`Delete ${item.title}`}
                            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-[#4B6780] dark:text-[#93B4CF] hover:text-[#BE123C] dark:hover:text-[#FB7185] hover:bg-[#FFF1F2] dark:hover:bg-[#3B1020] rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#F5FAFF] dark:bg-[#0D1C2B] border-t border-[#D4E7F7] dark:border-[#1E3750] text-sm font-semibold">
                  <td colSpan={3} className="py-3.5 pl-5 sm:pl-6 pr-3 text-[#0F2537] dark:text-[#EDF6FF]">
                    Active Monthly Total
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-[#0C4A6E] dark:text-[#38BDF8]">
                    {formatCurrency(totalMonthlyIncome)}
                  </td>
                  <td colSpan={2} className="py-3.5 pl-3 pr-5 sm:pr-6" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
