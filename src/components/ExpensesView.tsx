import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  BudgetCategory,
  ExpenseItem,
  FREQUENCY_META,
  formatCurrency,
  formatPercent,
  toMonthlyAmount,
} from '../types/budget';

interface ExpensesViewProps {
  categories: BudgetCategory[];
  expenses: ExpenseItem[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  onAddExpense: (defaultCategoryId?: string) => void;
  onEditExpense: (expense: ExpenseItem) => void;
  onDeleteExpense: (id: string) => void;
}

type SortOption = 'monthly-desc' | 'monthly-asc' | 'date-desc' | 'name-asc';

export function ExpensesView({
  categories,
  expenses,
  selectedCategoryId,
  onSelectCategory,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
}: ExpensesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('monthly-desc');

  const categoryMap = useMemo(() => {
    const map = new Map<string, BudgetCategory>();
    categories.forEach((cat) => map.set(cat.id, cat));
    return map;
  }, [categories]);

  const totalAllMonthly = useMemo(
    () => expenses.reduce((sum, e) => sum + toMonthlyAmount(e.amount, e.frequency), 0),
    [expenses]
  );

  const filteredExpenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = expenses.filter((item) => {
      const matchesCategory =
        selectedCategoryId === 'all' || item.categoryId === selectedCategoryId;
      if (!matchesCategory) return false;
      if (!q) return true;
      const catName = categoryMap.get(item.categoryId)?.name.toLowerCase() ?? '';
      return (
        item.title.toLowerCase().includes(q) ||
        catName.includes(q) ||
        (item.note?.toLowerCase().includes(q) ?? false)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'monthly-desc') {
        return toMonthlyAmount(b.amount, b.frequency) - toMonthlyAmount(a.amount, a.frequency);
      }
      if (sortBy === 'monthly-asc') {
        return toMonthlyAmount(a.amount, a.frequency) - toMonthlyAmount(b.amount, b.frequency);
      }
      if (sortBy === 'name-asc') {
        return a.title.localeCompare(b.title);
      }
      return b.date.localeCompare(a.date);
    });
  }, [expenses, selectedCategoryId, searchQuery, sortBy, categoryMap]);

  const filteredMonthlyTotal = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + toMonthlyAmount(e.amount, e.frequency), 0),
    [filteredExpenses]
  );

  const activeCategory =
    selectedCategoryId !== 'all' ? categoryMap.get(selectedCategoryId) ?? null : null;

  return (
    <div className="space-y-6">
      {/* Category Filter Bar */}
      <div className="bg-white border border-[#D4E7F7] rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter expenses by category">
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategoryId === 'all'}
              onClick={() => onSelectCategory('all')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategoryId === 'all'
                  ? 'bg-[#0284C7] text-white'
                  : 'bg-[#EBF5FD] text-[#33516B] hover:bg-[#DCEEFB]'
              }`}
            >
              All Categories ({expenses.length})
            </button>

            {categories.map((cat) => {
              const count = expenses.filter((e) => e.categoryId === cat.id).length;
              const isSelected = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => onSelectCategory(cat.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-[#0284C7] text-white'
                      : 'bg-[#EBF5FD] text-[#33516B] hover:bg-[#DCEEFB]'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-[2px] shrink-0"
                    style={{ backgroundColor: isSelected ? '#FFFFFF' : cat.color }}
                    aria-hidden="true"
                  />
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() =>
              onAddExpense(selectedCategoryId !== 'all' ? selectedCategoryId : undefined)
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Expense
          </button>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-[#E6F1FA]">
          <div className="relative flex-1 max-w-md">
            <Search
              className="w-4 h-4 text-[#6B87A1] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search expenses, categories, or notes..."
              aria-label="Search expenses"
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#F8FBFE] border border-[#CBE2F5] rounded-lg text-[#0F2537] placeholder:text-[#7E9BB5] focus:bg-white focus:border-[#0284C7] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <label htmlFor="expense-sort" className="text-xs text-[#4B6780] whitespace-nowrap">
              Sort by
            </label>
            <select
              id="expense-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 text-xs font-medium bg-[#F8FBFE] border border-[#CBE2F5] rounded-lg text-[#0F2537] focus:bg-white focus:border-[#0284C7] focus:outline-none"
            >
              <option value="monthly-desc">Highest Monthly Cost</option>
              <option value="monthly-asc">Lowest Monthly Cost</option>
              <option value="date-desc">Newest Date</option>
              <option value="name-asc">Name (A–Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Expense Data Table */}
      <section className="bg-white border border-[#D4E7F7] rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-[#F5FAFF] border-b border-[#D4E7F7] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#0F2537]">
              {activeCategory ? `${activeCategory.name} Expenses` : 'All Student Expenses'}
            </h2>
            <p className="text-xs text-[#4B6780] mt-0.5">
              {filteredExpenses.length} {filteredExpenses.length === 1 ? 'entry' : 'entries'}
              <span aria-hidden="true"> · </span>
              Monthly subtotal{' '}
              <span className="font-mono tabular-nums font-medium text-[#0F2537]">
                {formatCurrency(filteredMonthlyTotal)}
              </span>
              {activeCategory && activeCategory.monthlyTarget > 0 ? (
                <>
                  <span aria-hidden="true"> · </span>
                  Target{' '}
                  <span className="font-mono tabular-nums">
                    {formatCurrency(activeCategory.monthlyTarget)}
                  </span>
                </>
              ) : null}
            </p>
          </div>

          <div className="text-right">
            <div className="text-xs text-[#4B6780]">Annualized View</div>
            <div className="font-mono tabular-nums text-sm font-semibold text-[#0C4A6E]">
              {formatCurrency(filteredMonthlyTotal * 12)}/yr
            </div>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-12 text-center">
            <h3 className="text-sm font-semibold text-[#0F2537]">No matching expenses</h3>
            <p className="text-xs text-[#4B6780] mt-1">
              {searchQuery
                ? 'Try clearing your search term or switching category tabs.'
                : 'Add an expense to start calculating your monthly student budget.'}
            </p>
            <button
              type="button"
              onClick={() =>
                onAddExpense(selectedCategoryId !== 'all' ? selectedCategoryId : undefined)
              }
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Log Expense
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E3F0FB] text-xs font-medium text-[#4B6780] bg-[#FAFDFE]">
                  <th className="py-3 pl-6 pr-3">Expense</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Entered Amount</th>
                  <th className="py-3 px-3 text-right">Monthly Cost</th>
                  <th className="py-3 px-3 text-right">Share</th>
                  <th className="py-3 pl-3 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAF3FB] text-sm">
                {filteredExpenses.map((item) => {
                  const cat = categoryMap.get(item.categoryId);
                  const monthly = toMonthlyAmount(item.amount, item.frequency);
                  const share = totalAllMonthly > 0 ? (monthly / totalAllMonthly) * 100 : 0;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-[#F5FAFF] transition-colors"
                    >
                      <td className="py-3.5 pl-6 pr-3 max-w-[280px]">
                        <div className="font-medium text-[#0F2537] truncate">{item.title}</div>
                        <div className="text-xs text-[#607D96] mt-0.5 truncate">
                          <span>{item.date}</span>
                          {item.note && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span>{item.note}</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap text-xs text-[#33516B]">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                            style={{ backgroundColor: cat?.color ?? '#0284C7' }}
                            aria-hidden="true"
                          />
                          {cat?.name ?? 'Uncategorized'}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="font-mono tabular-nums text-[#0F2537]">
                          {formatCurrency(item.amount)}
                        </span>{' '}
                        <span className="text-xs text-[#607D96]">
                          {FREQUENCY_META[item.frequency].shortLabel}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono tabular-nums font-semibold text-[#0F2537]">
                        {formatCurrency(monthly)}
                      </td>

                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono tabular-nums text-xs text-[#4B6780]">
                        {formatPercent(share)}
                      </td>

                      <td className="py-3.5 pl-3 pr-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditExpense(item)}
                            aria-label={`Edit ${item.title}`}
                            className="p-1.5 text-[#4B6780] hover:text-[#0284C7] hover:bg-[#E1F0FC] rounded-md transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteExpense(item.id)}
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
                    Filtered Monthly Total
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-[#0C4A6E]">
                    {formatCurrency(filteredMonthlyTotal)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-xs text-[#4B6780]">
                    {totalAllMonthly > 0
                      ? formatPercent((filteredMonthlyTotal / totalAllMonthly) * 100)
                      : '0.0%'}
                  </td>
                  <td className="py-3.5 pl-3 pr-6" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
