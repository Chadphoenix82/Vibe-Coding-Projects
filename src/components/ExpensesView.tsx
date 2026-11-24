import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, ScanLine, Search, Trash2 } from 'lucide-react';
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
  onClearCategory: (categoryId: string, categoryName: string) => void;
  onClearAllExpenses: () => void;
  onOpenScanner: () => void;
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
  onClearCategory,
  onClearAllExpenses,
  onOpenScanner,
}: ExpensesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('monthly-desc');
  const [confirmClearScope, setConfirmClearScope] = useState(false);

  useEffect(() => {
    setConfirmClearScope(false);
  }, [selectedCategoryId]);

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
    <div className="space-y-5 sm:space-y-6">
      {/* Category Filter Bar */}
      <div className="bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="tablist"
            aria-label="Filter expenses by category"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategoryId === 'all'}
              onClick={() => onSelectCategory('all')}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategoryId === 'all'
                  ? 'bg-[#0284C7] dark:bg-[#0EA5E9] text-white dark:text-[#08131E]'
                  : 'bg-[#EBF5FD] dark:bg-[#162C42] text-[#33516B] dark:text-[#B8D2E8] hover:bg-[#DCEEFB] dark:hover:bg-[#1E3B57]'
              }`}
            >
              All ({expenses.length})
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
                  className={`min-h-[38px] inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-[#0284C7] dark:bg-[#0EA5E9] text-white dark:text-[#08131E]'
                      : 'bg-[#EBF5FD] dark:bg-[#162C42] text-[#33516B] dark:text-[#B8D2E8] hover:bg-[#DCEEFB] dark:hover:bg-[#1E3B57]'
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

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {(activeCategory
              ? expenses.some((e) => e.categoryId === activeCategory.id)
              : expenses.length > 0) && (
              confirmClearScope ? (
                <div className="inline-flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeCategory) {
                        onClearCategory(activeCategory.id, activeCategory.name);
                      } else {
                        onClearAllExpenses();
                      }
                      setConfirmClearScope(false);
                    }}
                    className="min-h-[38px] px-3 py-1.5 font-semibold text-white bg-[#BE123C] hover:bg-[#9F1239] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Confirm Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearScope(false)}
                    className="min-h-[38px] px-2.5 py-1.5 font-medium text-[#4B6780] dark:text-[#93B4CF] hover:text-[#0F2537] dark:hover:text-white rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearScope(true)}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#BE123C] dark:text-[#FB7185] bg-white dark:bg-[#112233] hover:bg-[#FFF1F2] dark:hover:bg-[#3B1020] border border-[#FECDD3] dark:border-[#5C1D2E] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  {activeCategory ? `Clear ${activeCategory.name}` : 'Clear All Expenses'}
                </button>
              )
            )}

            <button
              type="button"
              onClick={onOpenScanner}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#0C4A6E] dark:text-[#7DD3FC] bg-white dark:bg-[#112233] hover:bg-[#EBF5FD] dark:hover:bg-[#163049] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ScanLine className="w-3.5 h-3.5" aria-hidden="true" />
              Scan Doc
            </button>

            <button
              type="button"
              onClick={() =>
                onAddExpense(selectedCategoryId !== 'all' ? selectedCategoryId : undefined)
              }
              className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] dark:bg-[#0EA5E9] dark:text-[#08131E] dark:hover:bg-[#38BDF8] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Expense
            </button>
          </div>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row landscape:flex-row items-stretch sm:items-center landscape:items-center justify-between gap-3 pt-3 border-t border-[#E6F1FA] dark:border-[#1A3046]">
          <div className="relative flex-1 max-w-md">
            <Search
              className="w-4 h-4 text-[#6B87A1] dark:text-[#7496B5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search expenses, categories, or notes..."
              aria-label="Search expenses"
              className="w-full min-h-[42px] pl-9 pr-3 py-2 text-sm bg-[#F8FBFE] dark:bg-[#0B1825] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg text-[#0F2537] dark:text-[#EDF6FF] placeholder:text-[#7E9BB5] dark:placeholder:text-[#5E7E9B] focus:bg-white dark:focus:bg-[#0D1E2E] focus:border-[#0284C7] dark:focus:border-[#38BDF8] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <label
              htmlFor="expense-sort"
              className="text-xs text-[#4B6780] dark:text-[#93B4CF] whitespace-nowrap"
            >
              Sort by
            </label>
            <select
              id="expense-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="min-h-[42px] px-3 py-2 text-xs font-medium bg-[#F8FBFE] dark:bg-[#0B1825] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg text-[#0F2537] dark:text-[#EDF6FF] focus:bg-white dark:focus:bg-[#0D1E2E] focus:border-[#0284C7] dark:focus:border-[#38BDF8] focus:outline-none"
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
      <section className="bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl overflow-hidden">
        <div className="px-5 sm:px-6 py-4 bg-[#F5FAFF] dark:bg-[#0D1C2B] border-b border-[#D4E7F7] dark:border-[#1E3750] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
              {activeCategory ? `${activeCategory.name} Expenses` : 'All Student Expenses'}
            </h2>
            <p className="text-xs text-[#4B6780] dark:text-[#93B4CF] mt-0.5">
              {filteredExpenses.length} {filteredExpenses.length === 1 ? 'entry' : 'entries'}
              <span aria-hidden="true"> · </span>
              Monthly subtotal{' '}
              <span className="font-mono tabular-nums font-medium text-[#0F2537] dark:text-[#EDF6FF]">
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
            <div className="text-xs text-[#4B6780] dark:text-[#93B4CF]">Annualized View</div>
            <div className="font-mono tabular-nums text-sm font-semibold text-[#0C4A6E] dark:text-[#38BDF8]">
              {formatCurrency(filteredMonthlyTotal * 12)}/yr
            </div>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-12 text-center">
            <h3 className="text-sm font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
              No matching expenses
            </h3>
            <p className="text-xs text-[#4B6780] dark:text-[#93B4CF] mt-1">
              {searchQuery
                ? 'Try clearing your search term or switching category tabs.'
                : 'Add an expense to start calculating your monthly student budget.'}
            </p>
            <button
              type="button"
              onClick={() =>
                onAddExpense(selectedCategoryId !== 'all' ? selectedCategoryId : undefined)
              }
              className="mt-4 min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] dark:bg-[#0EA5E9] dark:text-[#08131E] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Log Expense
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E3F0FB] dark:border-[#1A3046] text-xs font-medium text-[#4B6780] dark:text-[#93B4CF] bg-[#FAFDFE] dark:bg-[#0E1E2E]">
                  <th className="py-3 pl-5 sm:pl-6 pr-3">Expense</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Entered</th>
                  <th className="py-3 px-3 text-right">Monthly</th>
                  <th className="py-3 px-3 text-right hidden sm:table-cell">Share</th>
                  <th className="py-3 pl-3 pr-5 sm:pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAF3FB] dark:divide-[#1A3046] text-sm">
                {filteredExpenses.map((item) => {
                  const cat = categoryMap.get(item.categoryId);
                  const monthly = toMonthlyAmount(item.amount, item.frequency);
                  const share = totalAllMonthly > 0 ? (monthly / totalAllMonthly) * 100 : 0;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-[#F5FAFF] dark:hover:bg-[#152B40] transition-colors"
                    >
                      <td className="py-3.5 pl-5 sm:pl-6 pr-3 max-w-[260px]">
                        <div className="font-medium text-[#0F2537] dark:text-[#EDF6FF] truncate">
                          {item.title}
                        </div>
                        <div className="text-xs text-[#607D96] dark:text-[#7496B5] mt-0.5 truncate">
                          <span>{item.date}</span>
                          {item.note && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span>{item.note}</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap text-xs text-[#33516B] dark:text-[#B8D2E8]">
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
                        <span className="font-mono tabular-nums text-[#0F2537] dark:text-[#EDF6FF]">
                          {formatCurrency(item.amount)}
                        </span>{' '}
                        <span className="text-xs text-[#607D96] dark:text-[#7496B5]">
                          {FREQUENCY_META[item.frequency].shortLabel}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono tabular-nums font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
                        {formatCurrency(monthly)}
                      </td>

                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono tabular-nums text-xs text-[#4B6780] dark:text-[#93B4CF] hidden sm:table-cell">
                        {formatPercent(share)}
                      </td>

                      <td className="py-3.5 pl-3 pr-5 sm:pr-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditExpense(item)}
                            aria-label={`Edit ${item.title}`}
                            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-[#4B6780] dark:text-[#93B4CF] hover:text-[#0284C7] dark:hover:text-[#38BDF8] hover:bg-[#E1F0FC] dark:hover:bg-[#19334C] rounded-md transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteExpense(item.id)}
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
                    Filtered Monthly Total
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-[#0C4A6E] dark:text-[#38BDF8]">
                    {formatCurrency(filteredMonthlyTotal)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-xs text-[#4B6780] dark:text-[#93B4CF] hidden sm:table-cell">
                    {totalAllMonthly > 0
                      ? formatPercent((filteredMonthlyTotal / totalAllMonthly) * 100)
                      : '0.0%'}
                  </td>
                  <td className="py-3.5 pl-3 pr-5 sm:pr-6" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
