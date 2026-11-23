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
}

export function CategoriesView({
  categories,
  expenses,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}: CategoriesViewProps) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('100');
  const [color, setColor] = useState(CATEGORY_COLOR_SWATCHES[4].hex);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

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
    <div className="space-y-6">
      {/* Category Cards Grid */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-[#0F2537]">Expense Categories & Targets</h2>
            <p className="text-sm text-[#4B6780]">
              Adjust monthly spending targets or colors for Utilities, Food, Study Materials, Gaming, and custom categories.
            </p>
          </div>
          <div className="text-sm text-[#4B6780]">
            Combined targets:{' '}
            <span className="font-mono tabular-nums font-semibold text-[#0C4A6E]">
              {formatCurrency(totalTargets)}/mo
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                className="bg-white border border-[#D4E7F7] rounded-xl p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-[3px] shrink-0"
                      style={{ backgroundColor: cat.color }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-[#0F2537] truncate">
                        {cat.name}
                      </h3>
                      <p className="text-xs text-[#4B6780] truncate">
                        {cat.description || `${catExpenses.length} logged items`}
                      </p>
                    </div>
                  </div>

                  {!cat.isDefault && categories.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteCategory(cat.id)}
                      aria-label={`Delete ${cat.name} category`}
                      className="p-1.5 text-[#4B6780] hover:text-[#BE123C] hover:bg-[#FFF1F2] rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Spent vs Target Bar */}
                <div>
                  <div className="flex items-baseline justify-between text-xs text-[#4B6780] mb-1.5">
                    <span>
                      Current monthly spend:{' '}
                      <span className="font-mono tabular-nums font-semibold text-[#0F2537]">
                        {formatCurrency(spent)}
                      </span>
                    </span>
                    <span className="font-mono tabular-nums">
                      {cat.monthlyTarget > 0 ? formatPercent(pct) : 'No cap'}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#EAF4FC] rounded-full overflow-hidden">
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
                <div className="pt-3 border-t border-[#E6F1FA] flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-[#4B6780]">
                    <span>Monthly limit</span>
                    <input
                      type="number"
                      step="5"
                      min="0"
                      aria-label={`${cat.name} monthly limit in USD`}
                      value={cat.monthlyTarget}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        onUpdateCategory(cat.id, {
                          monthlyTarget: Number.isFinite(val) && val >= 0 ? val : 0,
                        });
                      }}
                      className="w-24 px-2.5 py-1 text-xs font-mono tabular-nums bg-[#F8FBFE] border border-[#CBE2F5] rounded-md text-[#0F2537] focus:bg-white focus:border-[#0284C7] focus:outline-none"
                    />
                  </label>

                  <div className="flex items-center gap-1.5">
                    {CATEGORY_COLOR_SWATCHES.slice(0, 6).map((swatch) => (
                      <button
                        key={swatch.hex}
                        type="button"
                        onClick={() => onUpdateCategory(cat.id, { color: swatch.hex })}
                        aria-label={`Set ${cat.name} color to ${swatch.name}`}
                        aria-pressed={cat.color === swatch.hex}
                        className={`w-4 h-4 rounded-[4px] transition-transform cursor-pointer ${
                          cat.color === swatch.hex
                            ? 'ring-2 ring-offset-1 ring-[#0284C7] scale-110'
                            : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: swatch.hex }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Add Custom Category Form */}
      <section className="bg-white border border-[#D4E7F7] rounded-xl p-6">
        <h3 className="text-base font-semibold text-[#0F2537]">Add Custom Category</h3>
        <p className="text-xs text-[#4B6780] mt-0.5">
          Need a dedicated segment in your donut chart for Rent, Transit, or Subscriptions? Create one below.
        </p>

        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          {error && (
            <div role="alert" className="text-xs text-[#BE123C]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="cat-name" className="block text-xs font-medium text-[#0F2537] mb-1.5">
                Category Name
              </label>
              <input
                id="cat-name"
                type="text"
                placeholder="e.g., Transit, Rent, Health"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#F8FBFE] border border-[#CBE2F5] rounded-lg text-[#0F2537] placeholder:text-[#7E9BB5] focus:bg-white focus:border-[#0284C7] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="cat-target" className="block text-xs font-medium text-[#0F2537] mb-1.5">
                Monthly Target (USD)
              </label>
              <input
                id="cat-target"
                type="number"
                step="1"
                min="0"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#F8FBFE] border border-[#CBE2F5] rounded-lg text-[#0F2537] font-mono tabular-nums focus:bg-white focus:border-[#0284C7] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="cat-desc" className="block text-xs font-medium text-[#0F2537] mb-1.5">
                Short Note (optional)
              </label>
              <input
                id="cat-desc"
                type="text"
                placeholder="Bus pass, campus parking, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#F8FBFE] border border-[#CBE2F5] rounded-lg text-[#0F2537] placeholder:text-[#7E9BB5] focus:bg-white focus:border-[#0284C7] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#4B6780]">Slice color</span>
              <div className="flex items-center gap-2">
                {CATEGORY_COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => setColor(swatch.hex)}
                    aria-label={swatch.name}
                    aria-pressed={color === swatch.hex}
                    className={`w-6 h-6 rounded-md transition-transform cursor-pointer ${
                      color === swatch.hex
                        ? 'ring-2 ring-offset-2 ring-[#0284C7] scale-105'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
