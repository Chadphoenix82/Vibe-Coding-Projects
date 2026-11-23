import { useMemo, useState } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
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

interface OverviewViewProps {
  categories: BudgetCategory[];
  expenses: ExpenseItem[];
  incomes: IncomeItem[];
  savingsGoals: SavingsGoal[];
  onQuickAddExpense: (expense: Omit<ExpenseItem, 'id'>) => void;
  onAllocateGoal: (goalId: string, delta: number) => void;
  onOpenAddExpense: (defaultCategoryId?: string) => void;
  onOpenAddIncome: () => void;
  onOpenAddGoal: () => void;
  onNavigate: (tab: 'expenses' | 'income' | 'goals' | 'categories', categoryFilter?: string) => void;
}

export function OverviewView({
  categories,
  expenses,
  incomes,
  savingsGoals,
  onQuickAddExpense,
  onAllocateGoal,
  onOpenAddExpense,
  onOpenAddIncome,
  onOpenAddGoal,
  onNavigate,
}: OverviewViewProps) {
  const [pieMode, setPieMode] = useState<'expenses' | 'cashflow'>('expenses');
  const [selectedSliceId, setSelectedSliceId] = useState<string | null>(null);

  // Quick-add expense inline calculator state
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
        color: '#7DD3FC',
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

  return (
    <div className="space-y-6">
      {/* 4-Column Monthly Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-[#D4E7F7] rounded-xl p-5">
          <div className="text-xs font-medium text-[#4B6780]">Monthly Income</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-[#0F2537] mt-1.5">
            {formatCurrency(totalMonthlyIncome)}
          </div>
          <div className="text-xs text-[#4B6780] mt-2">
            {activeIncomes.length} active {activeIncomes.length === 1 ? 'source' : 'sources'}
            <span aria-hidden="true"> · </span>
            <span className="font-mono tabular-nums">{formatCurrency(totalMonthlyIncome * 12)}/yr</span>
          </div>
        </div>

        <div className="bg-white border border-[#D4E7F7] rounded-xl p-5">
          <div className="text-xs font-medium text-[#4B6780]">Monthly Expenses</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-[#0F2537] mt-1.5">
            {formatCurrency(totalMonthlyExpenses)}
          </div>
          <div className="text-xs text-[#4B6780] mt-2">
            {expenses.length} {expenses.length === 1 ? 'item' : 'items'}
            <span aria-hidden="true"> · </span>
            <span className="font-mono tabular-nums">
              {totalMonthlyIncome > 0 ? `${formatPercent(spentRatio)} of income` : 'Add income to compare'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#D4E7F7] rounded-xl p-5">
          <div className="text-xs font-medium text-[#4B6780]">Net Monthly Balance</div>
          <div
            className={`font-mono tabular-nums text-2xl font-semibold mt-1.5 ${
              netMonthlyBalance >= 0 ? 'text-[#0F766E]' : 'text-[#BE123C]'
            }`}
          >
            {formatCurrency(netMonthlyBalance, true)}
          </div>
          <div className="text-xs mt-2">
            <span className={netMonthlyBalance >= 0 ? 'text-[#0F766E] font-medium' : 'text-[#BE123C] font-medium'}>
              {netMonthlyBalance >= 0 ? 'Monthly surplus' : 'Monthly deficit'}
            </span>
            <span className="text-[#4B6780]">
              <span aria-hidden="true"> · </span>
              <span className="font-mono tabular-nums">
                {formatCurrency(Math.max(0, netMonthlyBalance) / 30)}/day free
              </span>
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#D4E7F7] rounded-xl p-5">
          <div className="text-xs font-medium text-[#4B6780]">Savings Goals Funded</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-[#0F2537] mt-1.5">
            {formatCurrency(totalSavedAmount)}
          </div>
          <div className="text-xs text-[#4B6780] mt-2">
            {savingsGoals.length > 0 ? (
              <>
                <span className="font-mono tabular-nums">{formatPercent(overallGoalProgress)}</span> of{' '}
                <span className="font-mono tabular-nums">{formatCurrency(totalGoalTarget)}</span>
              </>
            ) : (
              'No savings goals set yet'
            )}
          </div>
        </div>
      </div>

      {/* Main 2-Column Split: Focal Circular Pie Chart + Quick Calculator & Category Targets */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.95fr] gap-6 items-stretch">
        <CircularPieChart
          mode={pieMode}
          onModeChange={setPieMode}
          slices={pieSlices}
          totalAmount={pieTotal}
          monthlyIncome={totalMonthlyIncome}
          selectedSliceId={selectedSliceId}
          onSelectSlice={setSelectedSliceId}
          onInspectCategory={(catId) => onNavigate('expenses', catId)}
          onAddFirstExpense={() => onOpenAddExpense()}
        />

        <section className="bg-white border border-[#D4E7F7] rounded-xl p-6 flex flex-col justify-between gap-6">
          {/* Quick Expense Input Calculator */}
          <div>
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-[#E6F1FA]">
              <div>
                <h2 className="text-lg font-semibold text-[#0F2537] tracking-tight">
                  Quick Expense Entry
                </h2>
                <p className="text-xs text-[#4B6780] mt-0.5">
                  Log an item to recalculate your donut chart immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('expenses')}
                className="text-xs font-medium text-[#0284C7] hover:text-[#0369A1] whitespace-nowrap shrink-0 cursor-pointer"
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
                  className="w-full px-3 py-2 text-sm bg-[#F8FBFE] border border-[#CBE2F5] rounded-lg text-[#0F2537] placeholder:text-[#7E9BB5] focus:bg-white focus:border-[#0284C7] focus:outline-none"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  aria-label="Expense amount in USD"
                  placeholder="$0.00"
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#F8FBFE] border border-[#CBE2F5] rounded-lg text-[#0F2537] font-mono tabular-nums placeholder:text-[#7E9BB5] focus:bg-white focus:border-[#0284C7] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2.5">
                <select
                  aria-label="Expense category"
                  value={quickCategoryId}
                  onChange={(e) => setQuickCategoryId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#F8FBFE] border border-[#CBE2F5] rounded-lg text-[#0F2537] focus:bg-white focus:border-[#0284C7] focus:outline-none"
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
                  className="w-full px-3 py-2 text-sm bg-[#F8FBFE] border border-[#CBE2F5] rounded-lg text-[#0F2537] focus:bg-white focus:border-[#0284C7] focus:outline-none"
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="semester">Per Semester</option>
                  <option value="onetime">One-time</option>
                </select>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>

              {quickError && (
                <p role="alert" className="text-xs text-[#BE123C]">
                  {quickError}
                </p>
              )}
            </form>
          </div>

          {/* Category Targets Progress */}
          <div className="pt-5 border-t border-[#E6F1FA]">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="text-sm font-semibold text-[#0F2537]">Category Monthly Limits</h3>
              <button
                type="button"
                onClick={() => onNavigate('categories')}
                className="text-xs font-medium text-[#0284C7] hover:text-[#0369A1] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Adjust limits
              </button>
            </div>

            <div className="space-y-4">
              {categoryStats.map(({ category, monthlyTotal }) => {
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
                    ? 'text-[#BE123C]'
                    : pct >= 85
                    ? 'text-[#B45309]'
                    : 'text-[#4B6780]';

                return (
                  <div key={category.id}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <button
                        type="button"
                        onClick={() => onNavigate('expenses', category.id)}
                        className="font-medium text-[#0F2537] hover:text-[#0284C7] transition-colors truncate text-left cursor-pointer"
                      >
                        {category.name}
                      </button>
                      <div className="flex items-baseline gap-2 shrink-0">
                        <span className="font-mono tabular-nums font-medium text-[#0F2537]">
                          {formatCurrency(monthlyTotal)}
                        </span>
                        <span className="font-mono tabular-nums text-xs text-[#6B87A1]">
                          / {formatCurrency(target)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-1.5 h-2 w-full bg-[#EAF4FC] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-200"
                        style={{
                          width: `${clampedPct}%`,
                          backgroundColor: pct > 100 ? '#E11D48' : category.color,
                        }}
                      />
                    </div>

                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className={statusClass}>{statusLabel}</span>
                      <span className="font-mono tabular-nums text-[#6B87A1]">
                        {target > 0 ? formatPercent(pct) : '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Bottom 2-Column Split: Income Sources Summary + Savings Goals Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Income Sources Snapshot */}
        <section className="bg-white border border-[#D4E7F7] rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E6F1FA]">
              <div>
                <h2 className="text-base font-semibold text-[#0F2537]">Income Sources</h2>
                <p className="text-xs text-[#4B6780] mt-0.5">
                  Normalized to monthly income for cash-flow accuracy.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('income')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#0284C7] hover:text-[#0369A1] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Manage
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {incomes.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-[#4B6780]">No income sources added yet.</p>
                <button
                  type="button"
                  onClick={onOpenAddIncome}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#0C4A6E] bg-[#E0F2FE] hover:bg-[#BAE6FD] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Income Source
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#EAF3FB] mt-2">
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
                        <div className="text-sm font-medium text-[#0F2537] truncate">
                          {item.title}
                        </div>
                        <div className="text-xs text-[#4B6780] mt-0.5">
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
                        <div className="font-mono tabular-nums text-sm font-semibold text-[#0F2537]">
                          {formatCurrency(monthlyVal)}
                        </div>
                        <div className="text-[11px] text-[#6B87A1]">per month</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 mt-2 border-t border-[#E6F1FA] flex items-center justify-between text-xs text-[#4B6780]">
            <span>Active monthly total</span>
            <span className="font-mono tabular-nums text-sm font-semibold text-[#0C4A6E]">
              {formatCurrency(totalMonthlyIncome)}/mo
            </span>
          </div>
        </section>

        {/* Savings Goals Snapshot */}
        <section className="bg-white border border-[#D4E7F7] rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E6F1FA]">
              <div>
                <h2 className="text-base font-semibold text-[#0F2537]">Savings Goals</h2>
                <p className="text-xs text-[#4B6780] mt-0.5">
                  Allocate extra funds directly toward your student milestones.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('goals')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#0284C7] hover:text-[#0369A1] whitespace-nowrap shrink-0 cursor-pointer"
              >
                All goals
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {savingsGoals.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-[#4B6780]">
                  Set a goal like a New Laptop or Vacation to track your savings progress.
                </p>
                <button
                  type="button"
                  onClick={onOpenAddGoal}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#0C4A6E] bg-[#E0F2FE] hover:bg-[#BAE6FD] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
                          <span className="text-sm font-medium text-[#0F2537] truncate block">
                            {goal.name}
                          </span>
                          <span className="text-xs text-[#4B6780] font-mono tabular-nums">
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
                                className="px-2.5 py-1 text-xs font-mono font-medium text-[#0369A1] bg-[#EBF5FD] hover:bg-[#D5ECFC] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                +$25
                              </button>
                              <button
                                type="button"
                                onClick={() => onAllocateGoal(goal.id, 50)}
                                className="px-2.5 py-1 text-xs font-mono font-medium text-[#0369A1] bg-[#EBF5FD] hover:bg-[#D5ECFC] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                +$50
                              </button>
                            </>
                          ) : (
                            <span className="text-xs font-medium text-[#0F766E]">Goal reached</span>
                          )}
                        </div>
                      </div>

                      <div className="h-2 w-full bg-[#EAF4FC] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-200"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: isComplete ? '#0F766E' : goal.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-[#E6F1FA] flex items-center justify-between text-xs text-[#4B6780]">
            <span>Planned monthly contribution</span>
            <span className="font-mono tabular-nums text-sm font-semibold text-[#0C4A6E]">
              {formatCurrency(totalGoalMonthlyAllocation)}/mo
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
