import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  BudgetCategory,
  CATEGORY_COLOR_SWATCHES,
  ExpenseItem,
  formatCurrency,
  formatPercent,
  toMonthlyAmount,
} from '../types/budget';

interface CategoriesViewProps {
  categories: BudgetCategory[];
  expenses: ExpenseItem[];
  onAddCategory: (category: Omit<BudgetCategory, 'id'>) => void;
  onUpdateCategory: (id: string, updates: Partial<Omit<BudgetCategory, 'id'>>) => void;
  onDeleteCategory: (id: string) => void;
  onClearCategory: (categoryId: string, categoryName: string) => void;
  onClearAllData: () => void;
}

export function CategoriesView({
  categories,
  expenses,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onClearCategory,
  onClearAllData,
}: CategoriesViewProps) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('100');
  const [color, setColor] = useState(CATEGORY_COLOR_SWATCHES[4].hex);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmClearCatId, setConfirmClearCatId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const totalTargets = categories.reduce((sum, c) => sum + c.monthlyTarget, 0);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a category name (for example, Transit or Rent).');
      return;
    }
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('A category with that name already exists.');
      return;
    }
    const targetNum = parseFloat(target || '0');
    if (!Number.isFinite(targetNum) || targetNum < 0) {
      setError('Monthly target must be $0 or higher.');
      return;
    }
    onAddCategory({
      name: trimmed,
      monthlyTarget: Number(targetNum.toFixed(2)),
      color,
      description: description.trim() || undefined,
    });
    setName('');
    setTarget('100');
    setDescription('');
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Category Cards Grid */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
              Expense Categories & Targets
            </h2>
            <p className="text-sm text-[#4B6780] dark:text-[#93B4CF]">
              Adjust monthly spending targets or colors for Utilities, Food, Study Materials, Gaming, and custom categories.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-[#4B6780] dark:text-[#93B4CF]">
              Combined targets:{' '}
              <span className="font-mono tabular-nums font-semibold text-[#0C4A6E] dark:text-[#38BDF8]">
                {formatCurrency(totalTargets)}/mo
              </span>
            </div>

            {confirmClearAll ? (
              <div className="inline-flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    onClearAllData();
                    setConfirmClearAll(false);
                  }}
                  className="min-h-[34px] px-3 py-1 font-semibold text-white bg-[#BE123C] hover:bg-[#9F1239] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Confirm Clear All
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className="min-h-[34px] px-2.5 py-1 text-[#4B6780] dark:text-[#93B4CF] hover:text-[#0F2537] dark:hover:text-white cursor-pointer"
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
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 landscape:grid-cols-2 md:grid-cols-2 gap-4">
          {categories.map((cat) => {
            const catExpenses = expenses.filter((e) => e.categoryId === cat.id);
            const spent = catExpenses.reduce(
              (sum, e) => sum + toMonthlyAmount(e.amount, e.frequency),
              0
            );
            const pct = cat.monthlyTarget > 0 ? (spent / cat.monthlyTarget) * 100 : 0;

            return (
              <div
                key={cat.id}
                className="bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-[3px] shrink-0"
                      style={{ backgroundColor: cat.color }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-[#0F2537] dark:text-[#EDF6FF] truncate">
                        {cat.name}
                      </h3>
                      <p className="text-xs text-[#4B6780] dark:text-[#93B4CF] truncate">
                        {cat.description || `${catExpenses.length} logged items`}
                      </p>
                    </div>
                  </div>

                  {!cat.isDefault && categories.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteCategory(cat.id)}
                      aria-label={`Delete ${cat.name} category`}
                      className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-[#4B6780] dark:text-[#93B4CF] hover:text-[#BE123C] dark:hover:text-[#FB7185] hover:bg-[#FFF1F2] dark:hover:bg-[#3B1020] rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Spent vs Target Bar */}
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-[#4B6780] dark:text-[#93B4CF] mb-1.5">
                    <span className="min-w-0">
                      Current monthly spend:{' '}
                      <span className="font-mono tabular-nums font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
                        {formatCurrency(spent)}
                      </span>
                    </span>
                    <span className="font-mono tabular-nums shrink-0">
                      {cat.monthlyTarget > 0 ? formatPercent(pct) : 'No cap'}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#EAF4FC] dark:bg-[#193047] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-200"
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        backgroundColor: pct > 100 ? '#E11D48' : cat.color,
                      }}
                    />
                  </div>
                </div>

                {/* Inline Target & Color Controls */}
                <div className="pt-3 border-t border-[#E6F1FA] dark:border-[#1A3046] flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-[#4B6780] dark:text-[#93B4CF]">
                    <span>Monthly limit</span>
                    <input
                      type="number"
                      step="5"
                      min="0"
                      inputMode="decimal"
                      aria-label={`${cat.name} monthly limit in USD`}
                      value={cat.monthlyTarget}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        onUpdateCategory(cat.id, {
                          monthlyTarget: Number.isFinite(val) && val >= 0 ? val : 0,
                        });
                      }}
                      className="w-24 min-h-[36px] px-2.5 py-1 text-xs font-mono tabular-nums bg-[#F8FBFE] dark:bg-[#0B1825] border border-[#CBE2F5] dark:border-[#1E3750] rounded-md text-[#0F2537] dark:text-[#EDF6FF] focus:bg-white dark:focus:bg-[#0D1E2E] focus:border-[#0284C7] dark:focus:border-[#38BDF8] focus:outline-none"
                    />
                  </label>

                    <div className="flex items-center gap-2">
                      {CATEGORY_COLOR_SWATCHES.slice(0, 6).map((swatch) => (
                        <button
                          key={swatch.hex}
                          type="button"
                          onClick={() => onUpdateCategory(cat.id, { color: swatch.hex })}
                          aria-label={`Set ${cat.name} color to ${swatch.name}`}
                          aria-pressed={cat.color === swatch.hex}
                          className={`w-5 h-5 rounded-[4px] transition-transform cursor-pointer ${
                            cat.color === swatch.hex
                              ? 'ring-2 ring-offset-1 ring-[#0284C7] dark:ring-[#38BDF8] dark:ring-offset-[#112233] scale-110'
                              : 'hover:scale-110'
                          }`}
                          style={{ backgroundColor: swatch.hex }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Per-Category Clear Expenses Row */}
                  <div className="pt-3 border-t border-[#E6F1FA] dark:border-[#1A3046] flex items-center justify-between gap-2 text-xs">
                    <span className="text-[#4B6780] dark:text-[#93B4CF]">
                      {catExpenses.length} {catExpenses.length === 1 ? 'logged item' : 'logged items'}
                    </span>

                    {catExpenses.length > 0 ? (
                      confirmClearCatId === cat.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onClearCategory(cat.id, cat.name);
                              setConfirmClearCatId(null);
                            }}
                            className="min-h-[32px] px-2.5 py-1 font-semibold text-white bg-[#BE123C] hover:bg-[#9F1239] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Confirm Clear
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmClearCatId(null)}
                            className="min-h-[32px] px-2 py-1 text-[#4B6780] dark:text-[#93B4CF] hover:text-[#0F2537] dark:hover:text-white cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmClearCatId(cat.id)}
                          className="min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 font-medium text-[#BE123C] dark:text-[#FB7185] hover:bg-[#FFF1F2] dark:hover:bg-[#3B1020] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          Clear {cat.name}
                        </button>
                      )
                    ) : (
                      <span className="text-[#7E9BB5] dark:text-[#5E7E9B]">Empty</span>
                    )}
                  </div>
                </div>
            );
          })}
        </div>
      </section>

      {/* Add Custom Category Form */}
      <section className="bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl p-5 sm:p-6">
        <h3 className="text-base font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
          Add Custom Category
        </h3>
        <p className="text-xs text-[#4B6780] dark:text-[#93B4CF] mt-0.5">
          Need a dedicated segment in your donut chart for Rent, Transit, or Subscriptions? Create one below.
        </p>

        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          {error && (
            <div role="alert" className="text-xs text-[#BE123C] dark:text-[#FB7185]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 landscape:grid-cols-3 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="cat-name"
                className="block text-xs font-medium text-[#0F2537] dark:text-[#EDF6FF] mb-1.5"
              >
                Category Name
              </label>
              <input
                id="cat-name"
                type="text"
                placeholder="e.g., Transit, Rent, Health"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#F8FBFE] dark:bg-[#0B1825] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg text-[#0F2537] dark:text-[#EDF6FF] placeholder:text-[#7E9BB5] dark:placeholder:text-[#5E7E9B] focus:bg-white dark:focus:bg-[#0D1E2E] focus:border-[#0284C7] dark:focus:border-[#38BDF8] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="cat-target"
                className="block text-xs font-medium text-[#0F2537] dark:text-[#EDF6FF] mb-1.5"
              >
                Monthly Target (USD)
              </label>
              <input
                id="cat-target"
                type="number"
                step="1"
                min="0"
                inputMode="decimal"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#F8FBFE] dark:bg-[#0B1825] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg text-[#0F2537] dark:text-[#EDF6FF] font-mono tabular-nums focus:bg-white dark:focus:bg-[#0D1E2E] focus:border-[#0284C7] dark:focus:border-[#38BDF8] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="cat-desc"
                className="block text-xs font-medium text-[#0F2537] dark:text-[#EDF6FF] mb-1.5"
              >
                Short Note (optional)
              </label>
              <input
                id="cat-desc"
                type="text"
                placeholder="Bus pass, campus parking, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#F8FBFE] dark:bg-[#0B1825] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg text-[#0F2537] dark:text-[#EDF6FF] placeholder:text-[#7E9BB5] dark:placeholder:text-[#5E7E9B] focus:bg-white dark:focus:bg-[#0D1E2E] focus:border-[#0284C7] dark:focus:border-[#38BDF8] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-medium text-[#4B6780] dark:text-[#93B4CF]">
                Segment color
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {CATEGORY_COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => setColor(swatch.hex)}
                    aria-label={swatch.name}
                    aria-pressed={color === swatch.hex}
                    className={`w-7 h-7 rounded-md transition-transform cursor-pointer ${
                      color === swatch.hex
                        ? 'ring-2 ring-offset-2 ring-[#0284C7] dark:ring-[#38BDF8] dark:ring-offset-[#112233] scale-105'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] dark:bg-[#0EA5E9] dark:text-[#08131E] dark:hover:bg-[#38BDF8] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
