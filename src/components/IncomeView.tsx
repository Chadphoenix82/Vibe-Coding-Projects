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
    <div className="space-y-6">
      {/* 4-Column Income KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-[#D4E7F7] rounded-xl p-5">
          <div className="text-xs font-medium text-[#4B6780]">Active Monthly Income</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-[#0F2537] mt-1.5">
            {formatCurrency(totalMonthlyIncome)}
          </div>
          <div className="text-xs text-[#4B6780] mt-2">
            {activeIncomes.length} of {incomes.length} sources active
          </div>
        </div>

        <div className="bg-white border border-[#D4E7F7] rounded-xl p-5">
          <div className="text-xs font-medium text-[#4B6780]">Weekly Equivalent</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-[#0F2537] mt-1.5">
            {formatCurrency(weeklyEquivalent)}
          </div>
          <div className="text-xs text-[#4B6780] mt-2">Averaged across 52 weeks</div>
        </div>

        <div className="bg-white border border-[#D4E7F7] rounded-xl p-5">
          <div className="text-xs font-medium text-[#4B6780]">Annualized Income</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-[#0F2537] mt-1.5">
            {formatCurrency(annualEquivalent)}
          </div>
          <div className="text-xs text-[#4B6780] mt-2">12-month run rate</div>
        </div>

        <div className="bg-white border border-[#D4E7F7] rounded-xl p-5">
          <div className="text-xs font-medium text-[#4B6780]">Expense Coverage</div>
          <div
            className={`font-mono tabular-nums text-2xl font-semibold mt-1.5 ${
              totalMonthlyIncome >= monthlyExpenses ? 'text-[#0F766E]' : 'text-[#BE123C]'
            }`}
          >
            {formatPercent(coverageRatio)}
          </div>
          <div className="text-xs text-[#4B6780] mt-2">
            {totalMonthlyIncome >= monthlyExpenses ? 'Covers all expenses' : 'Below monthly expenses'}
          </div>
        </div>
      </div>

      {/* Stacked Income Share Visualization */}
      {activeIncomes.length > 0 && totalMonthlyIncome > 0 && (
        <section className="bg-white border border-[#D4E7F7] rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#0F2537]">Income Mix by Source</h2>
              <p className="text-xs text-[#4B6780] mt-0.5">
                Proportional contribution of each active income stream to your monthly budget.
              </p>
            </div>
            <span className="font-mono tabular-nums text-sm font-semibold text-[#0C4A6E]">
              {formatCurrency(totalMonthlyIncome)}/mo
            </span>
          </div>

          <div className="h-4 w-full bg-[#EAF4FC] rounded-full overflow-hidden flex gap-0.5">
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
                  <span className="font-medium text-[#0F2537]">{item.title}</span>
                  <span className="font-mono tabular-nums text-[#4B6780]">
                    {formatPercent(pct)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Income Sources Table */}
      <section className="bg-white border border-[#D4E7F7] rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-[#F5FAFF] border-b border-[#D4E7F7] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#0F2537]">All Income Sources</h2>
            <p className="text-xs text-[#4B6780] mt-0.5">
              Add part-time jobs, parental support, scholarships, or freelance work with any pay cadence.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddIncome}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Income Source
          </button>
        </div>

        {incomes.length === 0 ? (
          <div className="p-12 text-center">
            <h3 className="text-sm font-semibold text-[#0F2537]">No income sources recorded</h3>
            <p className="text-xs text-[#4B6780] mt-1 max-w-md mx-auto">
              Add your part-time job, family support, scholarship stipend, or tutoring income to calculate your monthly net balance.
            </p>
            <button
              type="button"
              onClick={onAddIncome}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add First Income Source
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E3F0FB] text-xs font-medium text-[#4B6780] bg-[#FAFDFE]">
                  <th className="py-3 pl-6 pr-3">Source</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Pay Schedule</th>
                  <th className="py-3 px-3 text-right">Monthly Equiv.</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 pl-3 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAF3FB] text-sm">
                {incomes.map((item) => {
                  const monthly = toMonthlyAmount(item.amount, item.frequency);
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-[#F5FAFF] transition-colors ${
                        item.active ? '' : 'opacity-60'
                      }`}
                    >
                      <td className="py-3.5 pl-6 pr-3 max-w-[260px]">
                        <div className="font-medium text-[#0F2537] truncate">{item.title}</div>
                        {item.note && (
                          <div className="text-xs text-[#607D96] mt-0.5 truncate">{item.note}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap text-xs text-[#33516B]">
                        {INCOME_SOURCE_LABELS[item.sourceType]}
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="font-mono tabular-nums text-[#0F2537]">
                          {formatCurrency(item.amount)}
                        </span>{' '}
                        <span className="text-xs text-[#607D96]">
                          {FREQUENCY_META[item.frequency].label}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono tabular-nums font-semibold text-[#0F2537]">
                        {formatCurrency(monthly)}
                      </td>

                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onToggleActive(item.id)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            item.active
                              ? 'text-[#0F766E] bg-[#ECFEFF] hover:bg-[#CFFAFE]'
                              : 'text-[#607D96] bg-[#EFF6FC] hover:bg-[#E1EFFB]'
                          }`}
                        >
                          {item.active ? 'Active' : 'Paused'}
                        </button>
                      </td>

                      <td className="py-3.5 pl-3 pr-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditIncome(item)}
                            aria-label={`Edit ${item.title}`}
                            className="p-1.5 text-[#4B6780] hover:text-[#0284C7] hover:bg-[#E1F0FC] rounded-md transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteIncome(item.id)}
                            aria-label={`Delete ${item.title}`}
                            className="p-1.5 text-[#4B6780] hover:text-[#BE123C] hover:bg-[#FFF1F2] rounded-md transition-colors cursor-pointer"
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
                <tr className="bg-[#F5FAFF] border-t border-[#D4E7F7] text-sm font-semibold">
                  <td colSpan={3} className="py-3.5 pl-6 pr-3 text-[#0F2537]">
                    Active Monthly Total
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-[#0C4A6E]">
                    {formatCurrency(totalMonthlyIncome)}
                  </td>
                  <td colSpan={2} className="py-3.5 pl-3 pr-6" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
