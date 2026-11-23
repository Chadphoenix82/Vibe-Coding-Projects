import { useMemo, useRef, useState } from 'react';
import {
  Download,
  FolderKanban,
  LayoutDashboard,
  Menu,
  PiggyBank,
  Plus,
  ReceiptText,
  RotateCcw,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { useLocalBudget } from './hooks/useLocalBudget';
import {
  FREQUENCY_META,
  INCOME_SOURCE_LABELS,
  formatCurrency,
  toMonthlyAmount,
} from './types/budget';
import { OverviewView } from './components/OverviewView';
import { ExpensesView } from './components/ExpensesView';
import { IncomeView } from './components/IncomeView';
import { SavingsGoalsView } from './components/SavingsGoalsView';
import { CategoriesView } from './components/CategoriesView';
import { EntryModal, ModalState } from './components/EntryModal';

type NavTab = 'overview' | 'expenses' | 'income' | 'goals' | 'categories';

const NAV_ITEMS: { id: NavTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'expenses', label: 'Expenses', icon: ReceiptText },
  { id: 'income', label: 'Income', icon: Wallet },
  { id: 'goals', label: 'Savings Goals', icon: PiggyBank },
  { id: 'categories', label: 'Categories', icon: FolderKanban },
];

const TAB_TITLES: Record<NavTab, string> = {
  overview: 'Overview',
  expenses: 'Expenses',
  income: 'Income',
  goals: 'Savings Goals',
  categories: 'Categories',
};

export default function App() {
  const {
    store,
    storageError,
    addExpense,
    updateExpense,
    deleteExpense,
    addIncome,
    updateIncome,
    toggleIncomeActive,
    deleteIncome,
    addSavingsGoal,
    updateSavingsGoal,
    allocateToSavingsGoal,
    deleteSavingsGoal,
    addCategory,
    updateCategory,
    deleteCategory,
    clearAllEntries,
    loadSampleData,
    importJsonData,
  } = useLocalBudget();

  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('all');
  const [modal, setModal] = useState<ModalState>({ type: 'closed' });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showFeedback = (message: string) => {
    setFeedbackMsg(message);
    window.setTimeout(() => {
      setFeedbackMsg((curr) => (curr === message ? null : curr));
    }, 3200);
  };

  const totalMonthlyIncome = useMemo(
    () =>
      store.incomes
        .filter((i) => i.active)
        .reduce((sum, i) => sum + toMonthlyAmount(i.amount, i.frequency), 0),
    [store.incomes]
  );

  const totalMonthlyExpenses = useMemo(
    () =>
      store.expenses.reduce(
        (sum, e) => sum + toMonthlyAmount(e.amount, e.frequency),
        0
      ),
    [store.expenses]
  );

  const monthlySurplus = totalMonthlyIncome - totalMonthlyExpenses;

  const handleNavigate = (tab: NavTab, categoryFilter?: string) => {
    setActiveTab(tab);
    if (tab === 'expenses') {
      setExpenseCategoryFilter(categoryFilter ?? 'all');
    }
    setMobileMenuOpen(false);
  };

  const handleExportCsv = () => {
    const categoryNameMap = new Map(store.categories.map((c) => [c.id, c.name]));
    const rows: string[][] = [
      ['Type', 'Title', 'Category / Source', 'Entered Amount (USD)', 'Frequency', 'Monthly Equivalent (USD)', 'Notes'],
    ];

    store.incomes.forEach((inc) => {
      rows.push([
        inc.active ? 'Income (Active)' : 'Income (Paused)',
        inc.title,
        INCOME_SOURCE_LABELS[inc.sourceType],
        inc.amount.toFixed(2),
        FREQUENCY_META[inc.frequency].label,
        toMonthlyAmount(inc.amount, inc.frequency).toFixed(2),
        inc.note ?? '',
      ]);
    });

    store.expenses.forEach((exp) => {
      rows.push([
        'Expense',
        exp.title,
        categoryNameMap.get(exp.categoryId) ?? 'Uncategorized',
        exp.amount.toFixed(2),
        FREQUENCY_META[exp.frequency].label,
        toMonthlyAmount(exp.amount, exp.frequency).toFixed(2),
        exp.note ?? '',
      ]);
    });

    store.savingsGoals.forEach((goal) => {
      rows.push([
        'Savings Goal',
        goal.name,
        `Saved ${formatCurrency(goal.savedAmount)} / ${formatCurrency(goal.targetAmount)}`,
        goal.monthlyAllocation.toFixed(2),
        'Monthly Plan',
        goal.monthlyAllocation.toFixed(2),
        goal.note ?? '',
      ]);
    });

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clearterm-student-budget-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showFeedback('Budget exported as CSV.');
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clearterm-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showFeedback('Local backup saved to your device.');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importJsonData(String(reader.result ?? ''));
      if (result.ok) {
        showFeedback('Budget backup restored into browser storage.');
      } else {
        showFeedback(result.error ?? 'Could not import file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const renderSidebarContent = () => (
    <div className="h-full flex flex-col justify-between p-5">
      <div>
        {/* Single-element Brand Wordmark */}
        <div className="flex items-center justify-between pb-6 mb-4 border-b border-[#D4E7F7]">
          <button
            type="button"
            onClick={() => handleNavigate('overview')}
            className="text-xl font-bold tracking-tight text-[#0C4A6E] whitespace-nowrap shrink-0 cursor-pointer"
          >
            ClearTerm
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
            className="lg:hidden p-1.5 text-[#4B6780] hover:text-[#0F2537] rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav aria-label="Primary navigation" className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#0C4A6E] border border-[#CBE2F5] shadow-2xs'
                    : 'text-[#3B5973] hover:bg-[#DFEFFB] hover:text-[#0F2537] border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-[#0284C7]' : 'text-[#5B7A96]'
                  }`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Compact Monthly Cash Flow Readout */}
        <div className="mt-6 pt-5 border-t border-[#D4E7F7] space-y-2.5 text-xs">
          <div className="flex items-center justify-between text-[#4B6780]">
            <span>Monthly Income</span>
            <span className="font-mono tabular-nums font-medium text-[#0F2537]">
              {formatCurrency(totalMonthlyIncome)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[#4B6780]">
            <span>Monthly Expenses</span>
            <span className="font-mono tabular-nums font-medium text-[#0F2537]">
              {formatCurrency(totalMonthlyExpenses)}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[#D4E7F7]">
            <span className="font-medium text-[#0F2537]">Net Balance</span>
            <span
              className={`font-mono tabular-nums font-semibold ${
                monthlySurplus >= 0 ? 'text-[#0F766E]' : 'text-[#BE123C]'
              }`}
            >
              {formatCurrency(monthlySurplus, true)}
            </span>
          </div>
        </div>
      </div>

      {/* Browser-Only Data Controls */}
      <div className="pt-5 border-t border-[#D4E7F7] space-y-3">
        <p className="text-[11px] leading-relaxed text-[#506E88]">
          Saved only in this browser. No account or remote server storage is used.
        </p>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#0C4A6E] bg-white hover:bg-[#F5FAFF] border border-[#CBE2F5] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#0C4A6E] bg-white hover:bg-[#F5FAFF] border border-[#CBE2F5] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Backup
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleImportFile}
          className="hidden"
          aria-label="Import JSON budget backup"
        />

        <div className="flex items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 text-[#3B5973] hover:text-[#0284C7] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Restore
          </button>

          {store.expenses.length === 0 &&
          store.incomes.length === 0 &&
          store.savingsGoals.length === 0 ? (
            <button
              type="button"
              onClick={() => {
                loadSampleData();
                showFeedback('Sample student budget loaded.');
              }}
              className="inline-flex items-center gap-1 text-[#0284C7] hover:text-[#0369A1] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Load Sample
            </button>
          ) : confirmClear ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  clearAllEntries();
                  setConfirmClear(false);
                  showFeedback('Cleared all local entries.');
                }}
                className="text-[#BE123C] font-semibold hover:underline cursor-pointer"
              >
                Confirm
              </button>
              <span className="text-[#94B4CE]" aria-hidden="true">/</span>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="text-[#4B6780] hover:text-[#0F2537] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="inline-flex items-center gap-1 text-[#4B6780] hover:text-[#BE123C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Data
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F2F8FD] text-[#0F2537] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[252px] shrink-0 bg-[#EBF5FD] border-r border-[#D4E7F7] sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-[#0F2537]/40 backdrop-blur-[1px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <aside className="w-[264px] max-w-[85vw] h-full bg-[#EBF5FD] border-r border-[#D4E7F7]">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on Left, Primary Actions on Right */}
        <header className="sticky top-0 z-30 bg-[#F2F8FD]/95 backdrop-blur-xs border-b border-[#D4E7F7] px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-[#0C4A6E] hover:bg-[#E1F0FC] rounded-lg transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-[#5B7A96] whitespace-nowrap shrink-0">Student Budget</span>
              <span className="text-[#94B4CE]" aria-hidden="true">/</span>
              <h1 className="font-semibold text-[#0F2537] truncate">
                {TAB_TITLES[activeTab]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setModal({ type: 'income' })}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#0C4A6E] bg-white hover:bg-[#EBF5FD] border border-[#CBE2F5] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Income
            </button>
            <button
              type="button"
              onClick={() => setModal({ type: 'expense' })}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Expense
            </button>
          </div>
        </header>

        {/* Main Scroll Area */}
        <main className="flex-1 w-full max-w-[1220px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
          {(storageError || feedbackMsg) && (
            <div
              role="status"
              className={`mb-5 px-4 py-2.5 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                storageError
                  ? 'bg-[#FFF1F2] border-[#FECDD3] text-[#9F1239]'
                  : 'bg-[#E0F2FE] border-[#BAE6FD] text-[#0C4A6E]'
              }`}
            >
              <span>{storageError ?? feedbackMsg}</span>
              <button
                type="button"
                onClick={() => setFeedbackMsg(null)}
                aria-label="Dismiss notification"
                className="text-current opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeTab === 'overview' && (
            <OverviewView
              categories={store.categories}
              expenses={store.expenses}
              incomes={store.incomes}
              savingsGoals={store.savingsGoals}
              onQuickAddExpense={(exp) => {
                addExpense(exp);
                showFeedback(`Added "${exp.title}" to your budget.`);
              }}
              onAllocateGoal={(goalId, delta) => {
                allocateToSavingsGoal(goalId, delta);
                showFeedback(`Allocated ${formatCurrency(delta)} toward your goal.`);
              }}
              onOpenAddExpense={(defaultCategoryId) =>
                setModal({ type: 'expense', defaultCategoryId })
              }
              onOpenAddIncome={() => setModal({ type: 'income' })}
              onOpenAddGoal={() => setModal({ type: 'goal' })}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesView
              categories={store.categories}
              expenses={store.expenses}
              selectedCategoryId={expenseCategoryFilter}
              onSelectCategory={setExpenseCategoryFilter}
              onAddExpense={(defaultCategoryId) =>
                setModal({ type: 'expense', defaultCategoryId })
              }
              onEditExpense={(expense) => setModal({ type: 'expense', editing: expense })}
              onDeleteExpense={(id) => {
                deleteExpense(id);
                showFeedback('Expense removed.');
              }}
            />
          )}

          {activeTab === 'income' && (
            <IncomeView
              incomes={store.incomes}
              monthlyExpenses={totalMonthlyExpenses}
              onAddIncome={() => setModal({ type: 'income' })}
              onEditIncome={(income) => setModal({ type: 'income', editing: income })}
              onToggleActive={toggleIncomeActive}
              onDeleteIncome={(id) => {
                deleteIncome(id);
                showFeedback('Income source removed.');
              }}
            />
          )}

          {activeTab === 'goals' && (
            <SavingsGoalsView
              goals={store.savingsGoals}
              monthlySurplus={monthlySurplus}
              onAddGoal={() => setModal({ type: 'goal' })}
              onEditGoal={(goal) => setModal({ type: 'goal', editing: goal })}
              onAllocate={(goalId, delta) => {
                allocateToSavingsGoal(goalId, delta);
                showFeedback(
                  delta > 0
                    ? `Deposited ${formatCurrency(delta)} to savings goal.`
                    : `Withdrew ${formatCurrency(Math.abs(delta))} from savings goal.`
                );
              }}
              onDeleteGoal={(id) => {
                deleteSavingsGoal(id);
                showFeedback('Savings goal removed.');
              }}
            />
          )}

          {activeTab === 'categories' && (
            <CategoriesView
              categories={store.categories}
              expenses={store.expenses}
              onAddCategory={(cat) => {
                addCategory(cat);
                showFeedback(`Created "${cat.name}" category.`);
              }}
              onUpdateCategory={updateCategory}
              onDeleteCategory={(id) => {
                deleteCategory(id);
                showFeedback('Category deleted and items reassigned.');
              }}
            />
          )}
        </main>
      </div>

      {/* Shared Modal for Adding / Editing Expenses, Income, and Savings Goals */}
      <EntryModal
        modal={modal}
        categories={store.categories}
        onClose={() => setModal({ type: 'closed' })}
        onSaveExpense={(data, editingId) => {
          if (editingId) {
            updateExpense(editingId, data);
            showFeedback(`Updated "${data.title}".`);
          } else {
            addExpense(data);
            showFeedback(`Added "${data.title}" to expenses.`);
          }
        }}
        onSaveIncome={(data, editingId) => {
          if (editingId) {
            updateIncome(editingId, data);
            showFeedback(`Updated "${data.title}".`);
          } else {
            addIncome(data);
            showFeedback(`Added "${data.title}" to income.`);
          }
        }}
        onSaveGoal={(data, editingId) => {
          if (editingId) {
            updateSavingsGoal(editingId, data);
            showFeedback(`Updated "${data.name}" goal.`);
          } else {
            addSavingsGoal(data);
            showFeedback(`Created "${data.name}" savings goal.`);
          }
        }}
      />
    </div>
  );
}
