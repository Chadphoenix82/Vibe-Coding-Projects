import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  BudgetCategory,
  CATEGORY_COLOR_SWATCHES,
  ExpenseItem,
  Frequency,
  FREQUENCY_META,
  INCOME_SOURCE_LABELS,
  IncomeItem,
  IncomeSourceType,
  SavingsGoal,
  formatCurrency,
  toMonthlyAmount,
} from '../types/budget';

export type ModalState =
  | { type: 'closed' }
  | { type: 'expense'; editing?: ExpenseItem; defaultCategoryId?: string }
  | { type: 'income'; editing?: IncomeItem }
  | { type: 'goal'; editing?: SavingsGoal };

interface EntryModalProps {
  modal: ModalState;
  categories: BudgetCategory[];
  onClose: () => void;
  onSaveExpense: (data: Omit<ExpenseItem, 'id'>, editingId?: string) => void;
  onSaveIncome: (data: Omit<IncomeItem, 'id'>, editingId?: string) => void;
  onSaveGoal: (data: Omit<SavingsGoal, 'id'>, editingId?: string) => void;
}

const FREQUENCIES: Frequency[] = [
  'monthly',
  'weekly',
  'biweekly',
  'semester',
  'annual',
  'onetime',
];

const INCOME_TYPES: IncomeSourceType[] = [
  'part-time-job',
  'parental-support',
  'scholarship',
  'freelance',
  'financial-aid',
  'other',
];

export function EntryModal({
  modal,
  categories,
  onClose,
  onSaveExpense,
  onSaveIncome,
  onSaveGoal,
}: EntryModalProps) {
  // Expense form state
  const [expTitle, setExpTitle] = useState('');
  const [expCategoryId, setExpCategoryId] = useState(categories[0]?.id ?? 'utilities');
  const [expAmount, setExpAmount] = useState('');
  const [expFrequency, setExpFrequency] = useState<Frequency>('monthly');
  const [expDate, setExpDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expNote, setExpNote] = useState('');

  // Income form state
  const [incTitle, setIncTitle] = useState('');
  const [incSourceType, setIncSourceType] = useState<IncomeSourceType>('part-time-job');
  const [incAmount, setIncAmount] = useState('');
  const [incFrequency, setIncFrequency] = useState<Frequency>('biweekly');
  const [incActive, setIncActive] = useState(true);
  const [incNote, setIncNote] = useState('');

  // Goal form state
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalSaved, setGoalSaved] = useState('0');
  const [goalMonthly, setGoalMonthly] = useState('');
  const [goalColor, setGoalColor] = useState(CATEGORY_COLOR_SWATCHES[0].hex);
  const [goalDate, setGoalDate] = useState('');
  const [goalNote, setGoalNote] = useState('');

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (modal.type === 'expense') {
      const e = modal.editing;
      setExpTitle(e?.title ?? '');
      setExpCategoryId(e?.categoryId ?? modal.defaultCategoryId ?? categories[0]?.id ?? 'utilities');
      setExpAmount(e ? String(e.amount) : '');
      setExpFrequency(e?.frequency ?? 'monthly');
      setExpDate(e?.date ?? new Date().toISOString().slice(0, 10));
      setExpNote(e?.note ?? '');
    } else if (modal.type === 'income') {
      const i = modal.editing;
      setIncTitle(i?.title ?? '');
      setIncSourceType(i?.sourceType ?? 'part-time-job');
      setIncAmount(i ? String(i.amount) : '');
      setIncFrequency(i?.frequency ?? 'biweekly');
      setIncActive(i ? i.active : true);
      setIncNote(i?.note ?? '');
    } else if (modal.type === 'goal') {
      const g = modal.editing;
      setGoalName(g?.name ?? '');
      setGoalTarget(g ? String(g.targetAmount) : '');
      setGoalSaved(g ? String(g.savedAmount) : '0');
      setGoalMonthly(g ? String(g.monthlyAllocation) : '');
      setGoalColor(g?.color ?? '#0284C7');
      setGoalDate(g?.targetDate ?? '');
      setGoalNote(g?.note ?? '');
    }
  }, [modal, categories]);

  useEffect(() => {
    if (modal.type === 'closed') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modal.type, onClose]);

  if (modal.type === 'closed') return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (modal.type === 'expense') {
      const amountNum = parseFloat(expAmount);
      if (!expTitle.trim()) {
        setError('Please enter a name for this expense.');
        return;
      }
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        setError('Please enter an amount greater than $0.');
        return;
      }
      onSaveExpense(
        {
          title: expTitle.trim(),
          categoryId: expCategoryId,
          amount: Number(amountNum.toFixed(2)),
          frequency: expFrequency,
          date: expDate || new Date().toISOString().slice(0, 10),
          note: expNote.trim() || undefined,
        },
        modal.editing?.id
      );
      onClose();
      return;
    }

    if (modal.type === 'income') {
      const amountNum = parseFloat(incAmount);
      if (!incTitle.trim()) {
        setError('Please enter a name for this income source.');
        return;
      }
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        setError('Please enter an amount greater than $0.');
        return;
      }
      onSaveIncome(
        {
          title: incTitle.trim(),
          sourceType: incSourceType,
          amount: Number(amountNum.toFixed(2)),
          frequency: incFrequency,
          active: incActive,
          note: incNote.trim() || undefined,
        },
        modal.editing?.id
      );
      onClose();
      return;
    }

    if (modal.type === 'goal') {
      const targetNum = parseFloat(goalTarget);
      const savedNum = parseFloat(goalSaved || '0');
      const monthlyNum = parseFloat(goalMonthly || '0');
      if (!goalName.trim()) {
        setError('Please name your savings goal (for example, New Laptop or Vacation).');
        return;
      }
      if (!Number.isFinite(targetNum) || targetNum <= 0) {
        setError('Please set a target amount greater than $0.');
        return;
      }
      if (!Number.isFinite(savedNum) || savedNum < 0) {
        setError('Already saved amount cannot be negative.');
        return;
      }
      if (!Number.isFinite(monthlyNum) || monthlyNum < 0) {
        setError('Monthly allocation cannot be negative.');
        return;
      }
      onSaveGoal(
        {
          name: goalName.trim(),
          targetAmount: Number(targetNum.toFixed(2)),
          savedAmount: Number(savedNum.toFixed(2)),
          monthlyAllocation: Number(monthlyNum.toFixed(2)),
          color: goalColor,
          targetDate: goalDate || undefined,
          note: goalNote.trim() || undefined,
        },
        modal.editing?.id
      );
      onClose();
    }
  };

  const titleText =
    modal.type === 'expense'
      ? modal.editing
        ? 'Edit Expense'
        : 'Add Expense'
      : modal.type === 'income'
      ? modal.editing
        ? 'Edit Income Source'
        : 'Add Income Source'
      : modal.editing
      ? 'Edit Savings Goal'
      : 'New Savings Goal';

  const parsedExpenseAmount = parseFloat(expAmount) || 0;
  const parsedIncomeAmount = parseFloat(incAmount) || 0;
  const monthlyExpensePreview = toMonthlyAmount(parsedExpenseAmount, expFrequency);
  const monthlyIncomePreview = toMonthlyAmount(parsedIncomeAmount, incFrequency);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F2537]/40 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-white border border-[#CBE2F5] rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#F2F8FD] border-b border-[#D4E7F7]">
          <h2 id="entry-modal-title" className="text-base font-semibold text-[#0F2537]">
            {titleText}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-[#4B6780] hover:text-[#0F2537] hover:bg-[#E1F0FC] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="px-3.5 py-2.5 text-sm text-[#9F1239] bg-[#FFF1F2] border border-[#FECDD3] rounded-lg"
            >
              {error}
            </div>
          )}

          {modal.type === 'expense' && (
            <>
              <div>
                <label htmlFor="exp-title" className="block text-sm font-medium text-[#0F2537] mb-1.5">
                  Expense Name
                </label>
                <input
                  id="exp-title"
                  type="text"
                  autoFocus
                  placeholder="e.g., Weekly Groceries, Fiber Wi-Fi, Calculus Textbook"
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#C6DFF4] rounded-lg text-[#0F2537] placeholder:text-[#7E9BB5] focus:border-[#0284C7] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="exp-category" className="block text-sm font-medium text-[#0F2537] mb-1.5">
                    Category
                  </label>
                  <select
                    id="exp-category"
                    value={expCategoryId}
                    onChange={(e) => setExpCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#C6DFF4] rounded-lg text-[#0F2537] focus:border-[#0284C7] focus:outline-none"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="exp-date" className="block text-sm font-medium text-[#0F2537] mb-1.5">
                    Date
                  </label>
                  <input
                    id="exp-date"
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#C6DFF4] rounded-lg text-[#0F2537] focus:border-[#0284C7] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="exp-amount" className="block text-sm font-medium text-[#0F2537] mb-1.5">
                    Amount (USD)
                  </label>
                  <input
                    id="exp-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#C6DFF4] rounded-lg text-[#0F2537] font-mono tabular-nums focus:border-[#0284C7] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="exp-frequency" className="block text-sm font-medium text-[#0F2537] mb-1.5">
                    Frequency
                  </label>
                  <select
                    id="exp-frequency"
                    value={expFrequency}
                    onChange={(e) => setExpFrequency(e.target.value as Frequency)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#C6DFF4] rounded-lg text-[#0F2537] focus:border-[#0284C7] focus:outline-none"
                  >
                    {FREQUENCIES.map((freq) => (
                      <option key={freq} value={freq}>
                        {FREQUENCY_META[freq].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="px-4 py-3 bg-[#F2F8FD] border border-[#D4E7F7] rounded-lg flex items-center justify-between text-sm">
                <span className="text-[#4B6780]">
                  Monthly budget impact ({FREQUENCY_META[expFrequency].formulaHint})
                </span>
                <span className="font-mono tabular-nums font-semibold text-[#0C4A6E]">
                  {formatCurrency(monthlyExpensePreview)}/mo
                </span>
              </div>

              <div>
                <label htmlFor="exp-note" className="block text-sm font-medium text-[#0F2537] mb-1.5">
                  Note (optional)
                </label>
                <input
                  id="exp-note"
                  type="text"
                  placeholder="Roommate split, semester book rental, etc."
                  value={expNote}
                  onChange={(e) => setExpNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#C6DFF4] rounded-lg text-[#0F2537] placeholder:text-[#7E9BB5] focus:border-[#0284C7] focus:outline-none"
                />
              </div>
            </>
          )}

          {modal.type === 'income' && (
            <>
              <div>
                <label htmlFor="inc-title" className="block text-sm font-medium text-[#0F2537] mb-1.5">
                  Income Source Name
                </label>
                <input
                  id="inc-title"
                  type="text"
                  autoFocus
                  placeholder="e.g., Campus Coffee Barista, Parents Monthly Support"
                  value={incTitle}
                  onChange={(e) => setIncTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#C6DFF4] rounded-lg text-[#0F2537] placeholder:text-[#7E9BB5] focus:border-[#0284C7] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="inc-type" className="block text-sm font-medium text-[#0F2537] mb-1.5">
                    Source Type
                  </label>
                  <select
                    id="inc-type"
                    value={incSourceType}
                    onChange={(e) => setIncSourceType(e.target.value as IncomeSourceType)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#C6DFF4] rounded-lg text-[#0F2537] focus:border-[#0284C7] focus:outline-none"
                  >
                    {INCOME_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {INCOME_SOURCE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="inc-frequency" className="block text-sm font-medium text-[#0F2537] mb-1.5">
                    Pay Frequency
                  </label>
                  <select
                    id="inc-frequency"
                    value={incFrequency}
                    onChange={(e) => setIncFrequency(e.target.value as Frequency)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#C6DFF4] rounded-lg text-[#0F2537] focus:border-[#0284C7] focus:outline-none"
                  >
                    {FREQUENCIES.map((freq) => (
                      <option key={freq} value={freq}>
                        {FREQUENCY_META[freq].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="inc-amount" className="block text-sm font-medium text-[#0F2537] mb-1.5">
                  Amount per Period (USD)
                </label>
                <input
                  id="inc-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={incAmount}
                  onChange={(e) => setIncAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#C6DFF4] rounded-lg text-[#0F2537] font-mono tabular-nums focus:border-[#0284C7] focus:outline-none"
                />
              </div>

              <div className="px-4 py-3 bg-[#F2F8FD] border border-[#D4E7F7] rounded-lg flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-[#4B6780]">
                  Normalized monthly ({FREQUENCY_META[incFrequency].formulaHint})
                </span>
                <span className="font-mono tabular-nums font-semibold text-[#0C4A6E]">
                  {formatCurrency(monthlyIncomePreview)}/mo
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 pt-1">
                <label htmlFor="inc-active" className="text-sm text-[#0F2537] cursor-pointer">
                  Include in active monthly budget
                </label>
                <input
                  id="inc-active"
                  type="checkbox"
                  checked={incActive}
                  onChange={(e) => setIncActive(e.target.checked)}
                  className="w-4 h-4 accent-[#0284C7] rounded cursor-pointer"
                />
              </div>

              <div>
                <label htmlFor="inc-note" className="block text-sm font-medium text-[#0F2537] mb-1.5">
                  Note (optional)
                </label>
                <input
                  id="inc-note"
                  type="text"
                  placeholder="Hours per week, payday schedule, or stipend details"
                  value={incNote}
                  onChange={(e) => setIncNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#C6DFF4] rounded-lg text-[#0F2537] placeholder:text-[#7E9BB5] focus:border-[#0284C7] focus:outline-none"
                />
              </div>
            </>
          )}

          {modal.type === 'goal' && (
            <>
              <div>
                <label htmlFor="goal-name" className="block text-sm font-medium text-[#0F2537] mb-1.5">
                  Goal Name
                </label>
                <input
                  id="goal-name"
                  type="text"
                  autoFocus
                  placeholder="e.g., New Laptop, Summer Vacation, Study Abroad"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#C6DFF4] rounded-lg text-[#0F2537] placeholder:text-[#7E9BB5] focus:border-[#0284C7] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="goal-target" className="block text-sm font-medium text-[#0F2537] mb-1.5">
                    Target Amount (USD)
                  </label>
                  <input
                    id="goal-target"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="1200.00"
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#C6DFF4] rounded-lg text-[#0F2537] font-mono tabular-nums focus:border-[#0284C7] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="goal-saved" className="block text-sm font-medium text-[#0F2537] mb-1.5">
                    Already Saved (USD)
                  </label>
                  <input
                    id="goal-saved"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={goalSaved}
                    onChange={(e) => setGoalSaved(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#C6DFF4] rounded-lg text-[#0F2537] font-mono tabular-nums focus:border-[#0284C7] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="goal-monthly" className="block text-sm font-medium text-[#0F2537] mb-1.5">
                    Monthly Contribution (USD)
                  </label>
                  <input
                    id="goal-monthly"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="100.00"
                    value={goalMonthly}
                    onChange={(e) => setGoalMonthly(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#C6DFF4] rounded-lg text-[#0F2537] font-mono tabular-nums focus:border-[#0284C7] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="goal-date" className="block text-sm font-medium text-[#0F2537] mb-1.5">
                    Target Date (optional)
                  </label>
                  <input
                    id="goal-date"
                    type="date"
                    value={goalDate}
                    onChange={(e) => setGoalDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#C6DFF4] rounded-lg text-[#0F2537] font-mono focus:border-[#0284C7] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <span className="block text-sm font-medium text-[#0F2537] mb-2">Accent Color</span>
                <div className="flex flex-wrap items-center gap-2.5">
                  {CATEGORY_COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch.hex}
                      type="button"
                      onClick={() => setGoalColor(swatch.hex)}
                      aria-label={swatch.name}
                      aria-pressed={goalColor === swatch.hex}
                      className={`w-7 h-7 rounded-lg transition-transform cursor-pointer ${
                        goalColor === swatch.hex
                          ? 'ring-2 ring-offset-2 ring-[#0284C7] scale-105'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: swatch.hex }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="goal-note" className="block text-sm font-medium text-[#0F2537] mb-1.5">
                  Note (optional)
                </label>
                <input
                  id="goal-note"
                  type="text"
                  placeholder="Model specs, trip destination, or milestone note"
                  value={goalNote}
                  onChange={(e) => setGoalNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#C6DFF4] rounded-lg text-[#0F2537] placeholder:text-[#7E9BB5] focus:border-[#0284C7] focus:outline-none"
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E6F1FA]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#4B6780] hover:text-[#0F2537] hover:bg-[#EBF5FD] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {modal.editing ? 'Save Changes' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
