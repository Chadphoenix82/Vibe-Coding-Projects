import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  SavingsGoal,
  formatCurrency,
  formatPercent,
} from '../types/budget';

interface SavingsGoalsViewProps {
  goals: SavingsGoal[];
  monthlySurplus: number;
  onAddGoal: () => void;
  onEditGoal: (goal: SavingsGoal) => void;
  onAllocate: (goalId: string, delta: number) => void;
  onDeleteGoal: (goalId: string) => void;
}

function RadialProgressRing({
  percentage,
  color,
}: {
  percentage: number;
  color: string;
}) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
      <svg viewBox="0 0 84 84" className="w-20 h-20 -rotate-90" aria-hidden="true">
        <circle
          cx="42"
          cy="42"
          r={radius}
          fill="none"
          stroke="#E3F1FC"
          strokeWidth="7"
        />
        <circle
          cx="42"
          cy="42"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <span className="absolute font-mono tabular-nums text-xs font-semibold text-[#0F2537]">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

export function SavingsGoalsView({
  goals,
  monthlySurplus,
  onAddGoal,
  onEditGoal,
  onAllocate,
  onDeleteGoal,
}: SavingsGoalsViewProps) {
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const totals = useMemo(() => {
    const saved = goals.reduce((sum, g) => sum + g.savedAmount, 0);
    const target = goals.reduce((sum, g) => sum + g.targetAmount, 0);
    const monthlyPlanned = goals.reduce((sum, g) => sum + g.monthlyAllocation, 0);
    const remaining = Math.max(0, target - saved);
    const progressPct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
    return { saved, target, monthlyPlanned, remaining, progressPct };
  }, [goals]);

  const handleCustomAllocate = (goalId: string, sign: 1 | -1) => {
    const raw = customAmounts[goalId] ?? '';
    const parsed = parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onAllocate(goalId, sign * parsed);
    setCustomAmounts((prev) => ({ ...prev, [goalId]: '' }));
  };

  const surplusAfterGoals = monthlySurplus - totals.monthlyPlanned;

  return (
    <div className="space-y-6">
      {/* Top KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-[#D4E7F7] rounded-xl p-5">
          <div className="text-xs font-medium text-[#4B6780]">Total Saved</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-[#0F2537] mt-1.5">
            {formatCurrency(totals.saved)}
          </div>
          <div className="text-xs text-[#4B6780] mt-2">
            Across {goals.length} {goals.length === 1 ? 'goal' : 'goals'}
          </div>
        </div>

        <div className="bg-white border border-[#D4E7F7] rounded-xl p-5">
          <div className="text-xs font-medium text-[#4B6780]">Combined Target</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-[#0F2537] mt-1.5">
            {formatCurrency(totals.target)}
          </div>
          <div className="text-xs text-[#4B6780] mt-2">
            <span className="font-mono tabular-nums">{formatCurrency(totals.remaining)}</span> remaining
          </div>
        </div>

        <div className="bg-white border border-[#D4E7F7] rounded-xl p-5">
          <div className="text-xs font-medium text-[#4B6780]">Overall Progress</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-[#0284C7] mt-1.5">
            {formatPercent(totals.progressPct)}
          </div>
          <div className="mt-2.5 h-1.5 w-full bg-[#E6F2FC] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0284C7] rounded-full transition-all duration-200"
              style={{ width: `${totals.progressPct}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-[#D4E7F7] rounded-xl p-5">
          <div className="text-xs font-medium text-[#4B6780]">Planned Monthly Allocation</div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-[#0F2537] mt-1.5">
            {formatCurrency(totals.monthlyPlanned)}
          </div>
          <div className="text-xs mt-2">
            {surplusAfterGoals >= 0 ? (
              <span className="text-[#0F766E]">
                Fits budget ·{' '}
                <span className="font-mono tabular-nums">{formatCurrency(surplusAfterGoals)}</span> left
              </span>
            ) : (
              <span className="text-[#B45309]">
                Exceeds surplus by{' '}
                <span className="font-mono tabular-nums">{formatCurrency(Math.abs(surplusAfterGoals))}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Header Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#0F2537]">Your Savings Milestones</h2>
          <p className="text-sm text-[#4B6780]">
            Deposit funds directly into any goal and track projected completion dates.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddGoal}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Savings Goal
        </button>
      </div>

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <div className="bg-white border border-[#D4E7F7] rounded-xl p-12 text-center">
          <h3 className="text-base font-semibold text-[#0F2537]">No savings goals yet</h3>
          <p className="text-sm text-[#4B6780] mt-1.5 max-w-md mx-auto">
            Create targets for big student purchases like a New Laptop, Spring Break Trip, or Emergency Fund and allocate funds as you save.
          </p>
          <button
            type="button"
            onClick={onAddGoal}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create First Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {goals.map((goal) => {
            const pct =
              goal.targetAmount > 0 ? Math.min(100, (goal.savedAmount / goal.targetAmount) * 100) : 0;
            const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
            const isComplete = remaining <= 0.001;
            const monthsToGoal =
              !isComplete && goal.monthlyAllocation > 0
                ? Math.ceil(remaining / goal.monthlyAllocation)
                : null;
            const ringColor = isComplete ? '#0F766E' : goal.color;

            return (
              <article
                key={goal.id}
                className="bg-white border border-[#D4E7F7] rounded-xl p-6 flex flex-col justify-between gap-5"
              >
                <div className="flex items-start gap-4">
                  <RadialProgressRing percentage={pct} color={ringColor} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-[#0F2537] truncate">
                          {goal.name}
                        </h3>
                        <div className="text-xs text-[#4B6780] mt-0.5">
                          {isComplete ? (
                            <span className="text-[#0F766E] font-medium">Target reached</span>
                          ) : (
                            <>
                              <span className="font-mono tabular-nums">
                                {formatCurrency(remaining)}
                              </span>{' '}
                              to go
                            </>
                          )}
                          {goal.targetDate && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span>Due {goal.targetDate}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onEditGoal(goal)}
                          aria-label={`Edit ${goal.name}`}
                          className="p-1.5 text-[#4B6780] hover:text-[#0284C7] hover:bg-[#EBF5FD] rounded-lg transition-colors cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteGoal(goal.id)}
                          aria-label={`Delete ${goal.name}`}
                          className="p-1.5 text-[#4B6780] hover:text-[#BE123C] hover:bg-[#FFF1F2] rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {goal.note && (
                      <p className="text-xs text-[#607D96] mt-2 line-clamp-2">{goal.note}</p>
                    )}

                    <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <span className="font-mono tabular-nums font-semibold text-[#0F2537]">
                        {formatCurrency(goal.savedAmount)}
                      </span>
                      <span className="font-mono tabular-nums text-xs text-[#4B6780]">
                        Goal {formatCurrency(goal.targetAmount)}
                      </span>
                    </div>

                    <div className="mt-1.5 h-2 w-full bg-[#EAF4FC] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-200"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: ringColor,
                        }}
                      />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#4B6780]">
                      <span>
                        Monthly plan:{' '}
                        <span className="font-mono tabular-nums font-medium text-[#0F2537]">
                          {formatCurrency(goal.monthlyAllocation)}/mo
                        </span>
                      </span>
                      <span>
                        {isComplete
                          ? 'Fully funded'
                          : monthsToGoal !== null
                          ? `Est. ${monthsToGoal} ${monthsToGoal === 1 ? 'month' : 'months'} left`
                          : 'Set monthly plan for ETA'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fund Allocation Controls */}
                <div className="pt-4 border-t border-[#E6F1FA] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[#4B6780]">Quick allocate</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[10, 25, 50, 100].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => onAllocate(goal.id, amt)}
                          className="px-2.5 py-1 text-xs font-mono font-medium text-[#0369A1] bg-[#EBF5FD] hover:bg-[#D5ECFC] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          +${amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      aria-label={`Custom allocation amount for ${goal.name}`}
                      placeholder="Custom amount ($)"
                      value={customAmounts[goal.id] ?? ''}
                      onChange={(e) =>
                        setCustomAmounts((prev) => ({ ...prev, [goal.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCustomAllocate(goal.id, 1);
                        }
                      }}
                      className="flex-1 min-w-0 px-3 py-1.5 text-sm bg-[#F8FBFE] border border-[#CBE2F5] rounded-lg text-[#0F2537] font-mono tabular-nums placeholder:text-[#7E9BB5] focus:bg-white focus:border-[#0284C7] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCustomAllocate(goal.id, 1)}
                      className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Deposit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCustomAllocate(goal.id, -1)}
                      disabled={goal.savedAmount <= 0}
                      className="px-3 py-1.5 text-xs font-medium text-[#4B6780] hover:text-[#0F2537] hover:bg-[#EBF5FD] disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
