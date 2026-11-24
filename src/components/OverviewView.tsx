import { useMemo, useState } from 'react';
import { ArrowRight, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  BudgetCategory,
  ExpenseItem,
  Frequency,
  FREQUENCY_META,
  INCOME_SOURCE_LABELS,
  IncomeItem,
  SavingsGoal,
  formatCurrency,
  formatPercent,
  toMonthlyAmount,
} from '../types/budget';
import { CircularPieChart, PieSliceDatum } from './CircularPieChart';
import { IncomeVsExpensesChart } from './IncomeVsExpensesChart';

interface OverviewViewProps {
  categories: BudgetCategory[];
  expenses: ExpenseItem[];
  incomes: IncomeItem[];
  savingsGoals: SavingsGoal[];
  isDark: boolean;
  onQuickAddExpense: (expense: Omit<ExpenseItem, 'id'>) => void;
  onAllocateGoal: (goalId: string, delta: number) => void;
  onOpenAddExpense: (defaultCategoryId?: string) => void;
  onOpenAddIncome: () => void;
  onOpenAddGoal: () => void;
  onClearCategory: (categoryId: string, categoryName: string) => void;
  onClearAllData: () => void;
  onLoadSampleData: () => void;
  onNavigate: (tab: 'expenses' | 'income' | 'goals' | 'categories', categoryFilter?: string) => void;
}

export function OverviewView({
  categories,
  expenses,
  incomes,
  savingsGoals,
  isDark,
  onQuickAddExpense,
  onAllocateGoal,
  onOpenAddExpense,
  onOpenAddIncome,
  onOpenAddGoal,
  onClearCategory,
  onClearAllData,
  onLoadSampleData,
  onNavigate,
}: OverviewViewProps) {
  const [pieMode, setPieMode] = useState<'expenses' | 'cashflow'>('expenses');
  const [selectedSliceId, setSelectedSliceId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confirmClearCatId, setConfirmClearCatId] = useState<string | null>(null);

  const [quickTitle, setQuickTitle] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickCategoryId, setQuickCategoryId] = useState(categories[0]?.id ?? 'utilities');
  const [quickFrequency, setQuickFrequency] = useState<Frequency>('monthly');
  const [quickError, setQuickError] = useState<string | null>(null);

  const activeIncomes = useMemo(() => incomes.filter((i) => i.active), [incomes]);

  const totalMonthlyIncome = useMemo(
    () => activeIncomes.reduce((sum, item) => sum + toMonthlyAmount(item.amount, item.frequency), 0),
    [activeIncomes]
  );

  const categoryStats = useMemo(() => {
    return categories.map((cat) => {
      const items = expenses.filter((e) => e.categoryId === cat.id);
      const monthlyTotal = items.reduce((sum, e) => sum + toMonthlyAmount(e.amount, e.frequency), 0);
      return {
        category: cat,
        itemCount: items.length,
        monthlyTotal,
      };
    });
  }, [categories, expenses]);

  const totalMonthlyExpenses = useMemo(
    () => categoryStats.reduce((sum, s) => sum + s.monthlyTotal, 0),
    [categoryStats]
  );

  const totalGoalMonthlyAllocation = useMemo(
    () => savingsGoals.reduce((sum, g) => sum + g.monthlyAllocation, 0),
    [savingsGoals]
  );

  const totalSavedAmount = useMemo(
    () => savingsGoals.reduce((sum, g) => sum + g.savedAmount, 0),
    [savingsGoals]
  );

  const totalGoalTarget = useMemo(
    () => savingsGoals.reduce((sum, g) => sum + g.targetAmount, 0),
    [savingsGoals]
  );

  const netMonthlyBalance = totalMonthlyIncome - totalMonthlyExpenses;
  const unallocatedMonthlyCash = Math.max(0, netMonthlyBalance - totalGoalMonthlyAllocation);
  const spentRatio = totalMonthlyIncome > 0 ? (totalMonthlyExpenses / totalMonthlyIncome) * 100 : 0;
  const overallGoalProgress = totalGoalTarget > 0 ? Math.min(100, (totalSavedAmount / totalGoalTarget) * 100) : 0;

  const pieSlices: PieSliceDatum[] = useMemo(() => {
    const expenseSlices: PieSliceDatum[] = categoryStats.map((stat) => ({
      id: stat.category.id,
      label: stat.category.name,
      value: stat.monthlyTotal,
      color: stat.category.color,
      target: stat.category.monthlyTarget,
      itemCount: stat.itemCount,
      isCategory: true,
    }));

    if (pieMode === 'expenses') {
      return expenseSlices;
    }

    const cashflowSlices = [...expenseSlices];
    if (totalGoalMonthlyAllocation > 0) {
      cashflowSlices.push({
        id: '__savings-goals',
        label: 'Savings Goals Plan',
        value: totalGoalMonthlyAllocation,
        color: '#0284C7',
        isCategory: false,
      });
    }
    if (unallocatedMonthlyCash > 0.01) {
      cashflowSlices.push({
        id: '__remaining-cash',
        label: 'Unallocated Cash',
        value: unallocatedMonthlyCash,
        color: '#38BDF8',
        isCategory: false,
      });
    }
    return cashflowSlices;
  }, [categoryStats, pieMode, totalGoalMonthlyAllocation, unallocatedMonthlyCash]);

  const pieTotal = useMemo(
    () => pieSlices.reduce((sum, s) => sum + s.value, 0),
    [pieSlices]
  );

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickError(null);
    const parsed = parseFloat(quickAmount);
    if (!quickTitle.trim()) {
      setQuickError('Enter a short description.');
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setQuickError('Enter an amount above $0.');
      return;
    }
    onQuickAddExpense({
      title: quickTitle.trim(),
      categoryId: quickCategoryId || categories[0]?.id || 'utilities',
      amount: Number(parsed.toFixed(2)),
      frequency: quickFrequency,
      date: new Date().toISOString().slice(0, 10),
    });
    setQuickTitle('');
    setQuickAmount('');
  };

  const hasAnyData = expenses.length > 0 || incomes.length > 0 || savingsGoals.length > 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Quick Overview Utility Strip: Clear All Data / Load Sample */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs sm:text-sm text-[#4B6780] dark:text-[#93B4CF]">
          All figures are calculated monthly and stored locally on this device.
        </p>

        {hasAnyData ? (
          confirmClearAll ? (
            <div className="inline-flex items-center gap-2 text-xs">
              <span className="text-[#4B6780] dark:text-[#93B4CF] hidden sm:inline">
                Reset all expenses, income &amp; goals?
              </span>
              <button
                type="button"
                onClick={() => {
                  onClearAllData();
                  setConfirmClearAll(false);
                  setSelectedSliceId(null);
                }}
                className="min-h-[36px] px-3 py-1.5 font-semibold text-white bg-[#BE123C] hover:bg-[#9F1239] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Confirm Clear All
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearAll(false)}
                className="min-h-[36px] px-3 py-1.5 font-medium text-[#4B6780] dark:text-[#93B4CF] bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] hover:bg-[#EBF5FD] dark:hover:bg-[#163049] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClearAll(true)}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#BE123C] dark:text-[#FB7185] bg-white dark:bg-[#112233] hover:bg-[#FFF1F2] dark:hover:bg-[#3B1020] border border-[#FECDD3] dark:border-[#5C1D2E] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              Clear All Data
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={onLoadSampleData}
            className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0C4A6E] dark:text-[#7DD3FC] bg-white dark:bg-[#112233] hover:bg-[#EBF5FD] dark:hover:bg-[#163049] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Load Sample Data
          </button>
        )}
      </div>

      {/* 4-Column Monthly Summary KPI Strip (4-up on wide landscape & desktop, 2x2 on compact phones) */}
      <div className="grid grid-cols-2 min-[840px]:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl p-4 sm:p-5 min-w-0">
          <div className="text-xs font-medium text-[#4B6780] dark:text-[#93B4CF] truncate">
            Monthly Income
          </div>
          <div className="font-mono tabular-nums text-base sm:text-xl font-semibold text-[#0F2537] dark:text-[#EDF6FF] mt-1 tracking-tight truncate">
            {formatCurrency(totalMonthlyIncome)}
          </div>
          <div className="text-[11px] sm:text-xs text-[#4B6780] dark:text-[#93B4CF] mt-1.5 truncate">
            {activeIncomes.length} active {activeIncomes.length === 1 ? 'source' : 'sources'}
            <span aria-hidden="true"> · </span>
            <span className="font-mono tabular-nums">{formatCurrency(totalMonthlyIncome * 12)}/yr</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl p-4 sm:p-5 min-w-0">
          <div className="text-xs font-medium text-[#4B6780] dark:text-[#93B4CF] truncate">
            Monthly Expenses
          </div>
          <div className="font-mono tabular-nums text-base sm:text-xl font-semibold text-[#0F2537] dark:text-[#EDF6FF] mt-1 tracking-tight truncate">
            {formatCurrency(totalMonthlyExpenses)}
          </div>
          <div className="text-[11px] sm:text-xs text-[#4B6780] dark:text-[#93B4CF] mt-1.5 truncate">
            {expenses.length} {expenses.length === 1 ? 'item' : 'items'}
            <span aria-hidden="true"> · </span>
            <span className="font-mono tabular-nums">
              {totalMonthlyIncome > 0 ? `${formatPercent(spentRatio)} of income` : 'No income yet'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl p-4 sm:p-5 min-w-0">
          <div className="text-xs font-medium text-[#4B6780] dark:text-[#93B4CF] truncate">
            Net Monthly Balance
          </div>
          <div
            className={`font-mono tabular-nums text-base sm:text-xl font-semibold mt-1 tracking-tight truncate ${
              netMonthlyBalance >= 0
                ? 'text-[#0F766E] dark:text-[#2DD4BF]'
                : 'text-[#BE123C] dark:text-[#FB7185]'
            }`}
          >
            {formatCurrency(netMonthlyBalance, true)}
          </div>
          <div className="text-[11px] sm:text-xs mt-1.5 truncate">
            <span
              className={
                netMonthlyBalance >= 0
                  ? 'text-[#0F766E] dark:text-[#2DD4BF] font-medium'
                  : 'text-[#BE123C] dark:text-[#FB7185] font-medium'
              }
            >
              {netMonthlyBalance >= 0 ? 'Surplus' : 'Deficit'}
            </span>
            <span className="text-[#4B6780] dark:text-[#93B4CF]">
              <span aria-hidden="true"> · </span>
              <span className="font-mono tabular-nums">
                {formatCurrency(Math.max(0, netMonthlyBalance) / 30)}/day
              </span>
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl p-4 sm:p-5 min-w-0">
          <div className="text-xs font-medium text-[#4B6780] dark:text-[#93B4CF] truncate">
            Savings Funded
          </div>
          <div className="font-mono tabular-nums text-base sm:text-xl font-semibold text-[#0F2537] dark:text-[#EDF6FF] mt-1 tracking-tight truncate">
            {formatCurrency(totalSavedAmount)}
          </div>
          <div className="text-[11px] sm:text-xs text-[#4B6780] dark:text-[#93B4CF] mt-1.5 truncate">
            {savingsGoals.length > 0 ? (
              <>
                <span className="font-mono tabular-nums">{formatPercent(overallGoalProgress)}</span> of{' '}
                <span className="font-mono tabular-nums">{formatCurrency(totalGoalTarget)}</span>
              </>
            ) : (
              'No savings goals set'
            )}
          </div>
        </div>
      </div>

      {/* Monthly Income vs. Expenses Bar Chart Summary (Recharts) */}
      <IncomeVsExpensesChart
        totalMonthlyIncome={totalMonthlyIncome}
        totalMonthlyExpenses={totalMonthlyExpenses}
        isDark={isDark}
        onAddIncome={onOpenAddIncome}
        onAddExpense={() => onOpenAddExpense()}
      />

      {/* Main 2-Column Split: Focal Donut Chart + Quick Calculator & Category Targets */}
      <div className="grid grid-cols-1 min-[900px]:grid-cols-[1.2fr_1fr] xl:grid-cols-[1.25fr_0.95fr] gap-5 sm:gap-6 items-stretch">
        <CircularPieChart
          mode={pieMode}
          onModeChange={setPieMode}
          slices={pieSlices}
          totalAmount={pieTotal}
          monthlyIncome={totalMonthlyIncome}
          selectedSliceId={selectedSliceId}
          onSelectSlice={setSelectedSliceId}
          onInspectCategory={(catId) => onNavigate('expenses', catId)}
          onClearCategory={(catId, catName) => onClearCategory(catId, catName)}
          onAddFirstExpense={() => onOpenAddExpense()}
        />

        <section className="bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl p-5 sm:p-6 flex flex-col justify-between gap-5">
          {/* Quick Expense Input Calculator */}
          <div>
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-[#E6F1FA] dark:border-[#1A3046]">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-[#0F2537] dark:text-[#EDF6FF] tracking-tight">
                  Quick Expense Entry
                </h2>
                <p className="text-xs text-[#4B6780] dark:text-[#93B4CF] mt-0.5">
                  Log an item to recalculate your donut chart immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('expenses')}
                className="min-h-[36px] px-2 text-xs font-medium text-[#0284C7] dark:text-[#38BDF8] hover:text-[#0369A1] dark:hover:text-[#7DD3FC] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Full ledger
              </button>
            </div>

            <form onSubmit={handleQuickAdd} className="mt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_116px] gap-2.5">
                <input
                  type="text"
                  aria-label="Expense description"
                  placeholder="e.g., Campus lunch, Electric bill, Steam sale"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#F8FBFE] dark:bg-[#0B1825] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg text-[#0F2537] dark:text-[#EDF6FF] placeholder:text-[#7E9BB5] dark:placeholder:text-[#5E7E9B] focus:bg-white dark:focus:bg-[#0D1E2E] focus:border-[#0284C7] dark:focus:border-[#38BDF8] focus:outline-none"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  aria-label="Expense amount in USD"
                  placeholder="$0.00"
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#F8FBFE] dark:bg-[#0B1825] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg text-[#0F2537] dark:text-[#EDF6FF] font-mono tabular-nums placeholder:text-[#7E9BB5] dark:placeholder:text-[#5E7E9B] focus:bg-white dark:focus:bg-[#0D1E2E] focus:border-[#0284C7] dark:focus:border-[#38BDF8] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] gap-2.5">
                <select
                  aria-label="Expense category"
                  value={quickCategoryId}
                  onChange={(e) => setQuickCategoryId(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#F8FBFE] dark:bg-[#0B1825] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg text-[#0F2537] dark:text-[#EDF6FF] focus:bg-white dark:focus:bg-[#0D1E2E] focus:border-[#0284C7] dark:focus:border-[#38BDF8] focus:outline-none"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Expense frequency"
                  value={quickFrequency}
                  onChange={(e) => setQuickFrequency(e.target.value as Frequency)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#F8FBFE] dark:bg-[#0B1825] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg text-[#0F2537] dark:text-[#EDF6FF] focus:bg-white dark:focus:bg-[#0D1E2E] focus:border-[#0284C7] dark:focus:border-[#38BDF8] focus:outline-none"
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="semester">Per Semester</option>
                  <option value="onetime">One-time</option>
                </select>

                <button
                  type="submit"
                  className="col-span-2 sm:col-span-1 min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] dark:bg-[#0EA5E9] dark:text-[#08131E] dark:hover:bg-[#38BDF8] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>

              {quickError && (
                <p role="alert" className="text-xs text-[#BE123C] dark:text-[#FB7185]">
                  {quickError}
                </p>
              )}
            </form>
          </div>

          {/* Category Targets Progress */}
          <div className="pt-4 border-t border-[#E6F1FA] dark:border-[#1A3046]">
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <h3 className="text-sm font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
                Category Monthly Limits
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('categories')}
                className="min-h-[32px] px-1 text-xs font-medium text-[#0284C7] dark:text-[#38BDF8] hover:text-[#0369A1] dark:hover:text-[#7DD3FC] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Adjust limits
              </button>
            </div>

            <div className="space-y-3.5">
              {categoryStats.map(({ category, itemCount, monthlyTotal }) => {
                const target = category.monthlyTarget;
                const pct = target > 0 ? (monthlyTotal / target) * 100 : 0;
                const clampedPct = Math.min(100, pct);
                const statusLabel =
                  target <= 0
                    ? 'No limit'
                    : pct > 100
                    ? 'Over limit'
                    : pct >= 85
                    ? 'Near limit'
                    : 'Within limit';
                const statusClass =
                  pct > 100
                    ? 'text-[#BE123C] dark:text-[#FB7185]'
                    : pct >= 85
                    ? 'text-[#B45309] dark:text-[#FBBF24]'
                    : 'text-[#4B6780] dark:text-[#93B4CF]';

                return (
                  <div key={category.id}>
                    <div className="flex items-baseline justify-between gap-2 text-xs sm:text-sm">
                      <button
                        type="button"
                        onClick={() => onNavigate('expenses', category.id)}
                        className="font-medium text-[#0F2537] dark:text-[#EDF6FF] hover:text-[#0284C7] dark:hover:text-[#38BDF8] transition-colors truncate min-w-0 flex-1 text-left cursor-pointer"
                      >
                        {category.name}
                      </button>
                      <div className="flex items-baseline gap-1.5 shrink-0">
                        <span className="font-mono tabular-nums text-xs sm:text-sm font-medium text-[#0F2537] dark:text-[#EDF6FF]">
                          {formatCurrency(monthlyTotal)}
                        </span>
                        <span className="font-mono tabular-nums text-[11px] text-[#6B87A1] dark:text-[#7496B5]">
                          / {formatCurrency(target)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-1.5 h-2 w-full bg-[#EAF4FC] dark:bg-[#193047] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-200"
                        style={{
                          width: `${clampedPct}%`,
                          backgroundColor: pct > 100 ? '#E11D48' : category.color,
                        }}
                      />
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                      <span className={statusClass}>
                        {statusLabel}
                        {target > 0 ? (
                          <span className="font-mono tabular-nums text-[#6B87A1] dark:text-[#7496B5]">
                            {' · '}
                            {formatPercent(pct)}
                          </span>
                        ) : null}
                      </span>

                      {itemCount > 0 && (
                        confirmClearCatId === category.id ? (
                          <div className="inline-flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                onClearCategory(category.id, category.name);
                                setConfirmClearCatId(null);
                              }}
                              className="text-[11px] font-semibold text-[#BE123C] dark:text-[#FB7185] hover:underline cursor-pointer"
                            >
                              Confirm clear
                            </button>
                            <span className="text-[#94B4CE] dark:text-[#456787]" aria-hidden="true">/</span>
                            <button
                              type="button"
                              onClick={() => setConfirmClearCatId(null)}
                              className="text-[11px] text-[#4B6780] dark:text-[#93B4CF] hover:text-[#0F2537] dark:hover:text-white cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmClearCatId(category.id)}
                            className="text-[11px] font-medium text-[#6B87A1] dark:text-[#7496B5] hover:text-[#BE123C] dark:hover:text-[#FB7185] transition-colors cursor-pointer shrink-0"
                          >
                            Clear {category.name}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Bottom 2-Column Split: Income Sources Summary + Savings Goals Snapshot */}
      <div className="grid grid-cols-1 landscape:grid-cols-2 lg:grid-cols-2 gap-5 sm:gap-6 items-stretch">
        {/* Income Sources Snapshot */}
        <section className="bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E6F1FA] dark:border-[#1A3046]">
              <div>
                <h2 className="text-base font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
                  Income Sources
                </h2>
                <p className="text-xs text-[#4B6780] dark:text-[#93B4CF] mt-0.5">
                  Normalized to monthly income for cash-flow accuracy.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('income')}
                className="min-h-[36px] inline-flex items-center gap-1 text-xs font-medium text-[#0284C7] dark:text-[#38BDF8] hover:text-[#0369A1] dark:hover:text-[#7DD3FC] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Manage
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {incomes.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-[#4B6780] dark:text-[#93B4CF]">
                  No income sources added yet.
                </p>
                <button
                  type="button"
                  onClick={onOpenAddIncome}
                  className="mt-3 min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#0C4A6E] dark:text-[#7DD3FC] bg-[#E0F2FE] dark:bg-[#163049] hover:bg-[#BAE6FD] dark:hover:bg-[#1E3F5E] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Income Source
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#EAF3FB] dark:divide-[#1A3046] mt-2">
                {incomes.slice(0, 4).map((item) => {
                  const monthlyVal = toMonthlyAmount(item.amount, item.frequency);
                  return (
                    <div
                      key={item.id}
                      className={`py-3 flex items-center justify-between gap-3 ${
                        item.active ? '' : 'opacity-55'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#0F2537] dark:text-[#EDF6FF] truncate">
                          {item.title}
                        </div>
                        <div className="text-xs text-[#4B6780] dark:text-[#93B4CF] mt-0.5">
                          {INCOME_SOURCE_LABELS[item.sourceType]}
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono tabular-nums">
                            {formatCurrency(item.amount)} {FREQUENCY_META[item.frequency].shortLabel}
                          </span>
                          {!item.active && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span>Paused</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono tabular-nums text-sm font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
                          {formatCurrency(monthlyVal)}
                        </div>
                        <div className="text-[11px] text-[#6B87A1] dark:text-[#7496B5]">per month</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 mt-2 border-t border-[#E6F1FA] dark:border-[#1A3046] flex items-center justify-between text-xs text-[#4B6780] dark:text-[#93B4CF]">
            <span>Active monthly total</span>
            <span className="font-mono tabular-nums text-sm font-semibold text-[#0C4A6E] dark:text-[#38BDF8]">
              {formatCurrency(totalMonthlyIncome)}/mo
            </span>
          </div>
        </section>

        {/* Savings Goals Snapshot */}
        <section className="bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E6F1FA] dark:border-[#1A3046]">
              <div>
                <h2 className="text-base font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
                  Savings Goals
                </h2>
                <p className="text-xs text-[#4B6780] dark:text-[#93B4CF] mt-0.5">
                  Allocate extra funds directly toward your student milestones.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('goals')}
                className="min-h-[36px] inline-flex items-center gap-1 text-xs font-medium text-[#0284C7] dark:text-[#38BDF8] hover:text-[#0369A1] dark:hover:text-[#7DD3FC] whitespace-nowrap shrink-0 cursor-pointer"
              >
                All goals
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {savingsGoals.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-[#4B6780] dark:text-[#93B4CF]">
                  Set a goal like a New Laptop or Vacation to track your savings progress.
                </p>
                <button
                  type="button"
                  onClick={onOpenAddGoal}
                  className="mt-3 min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#0C4A6E] dark:text-[#7DD3FC] bg-[#E0F2FE] dark:bg-[#163049] hover:bg-[#BAE6FD] dark:hover:bg-[#1E3F5E] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create First Goal
                </button>
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                {savingsGoals.slice(0, 3).map((goal) => {
                  const pct =
                    goal.targetAmount > 0
                      ? Math.min(100, (goal.savedAmount / goal.targetAmount) * 100)
                      : 0;
                  const isComplete = goal.savedAmount >= goal.targetAmount;

                  return (
                    <div key={goal.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-[#0F2537] dark:text-[#EDF6FF] truncate block">
                            {goal.name}
                          </span>
                          <span className="text-xs text-[#4B6780] dark:text-[#93B4CF] font-mono tabular-nums">
                            {formatCurrency(goal.savedAmount)} of {formatCurrency(goal.targetAmount)}
                            {' · '}
                            {Math.round(pct)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isComplete ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onAllocateGoal(goal.id, 25)}
                                className="min-h-[34px] px-2.5 py-1 text-xs font-mono font-medium text-[#0369A1] dark:text-[#7DD3FC] bg-[#EBF5FD] dark:bg-[#163049] hover:bg-[#D5ECFC] dark:hover:bg-[#1E3F5E] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                +$25
                              </button>
                              <button
                                type="button"
                                onClick={() => onAllocateGoal(goal.id, 50)}
                                className="min-h-[34px] px-2.5 py-1 text-xs font-mono font-medium text-[#0369A1] dark:text-[#7DD3FC] bg-[#EBF5FD] dark:bg-[#163049] hover:bg-[#D5ECFC] dark:hover:bg-[#1E3F5E] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                +$50
                              </button>
                            </>
                          ) : (
                            <span className="text-xs font-medium text-[#0F766E] dark:text-[#2DD4BF]">
                              Goal reached
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="h-2 w-full bg-[#EAF4FC] dark:bg-[#193047] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-200"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: isComplete ? '#14B8A6' : goal.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-[#E6F1FA] dark:border-[#1A3046] flex items-center justify-between text-xs text-[#4B6780] dark:text-[#93B4CF]">
            <span>Planned monthly contribution</span>
            <span className="font-mono tabular-nums text-sm font-semibold text-[#0C4A6E] dark:text-[#38BDF8]">
              {formatCurrency(totalGoalMonthlyAllocation)}/mo
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
