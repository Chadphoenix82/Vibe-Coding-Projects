import { useMemo, useRef, useState } from 'react';
import {
  Download,
  FolderKanban,
  LayoutDashboard,
  Menu,
  Monitor,
  Moon,
  PiggyBank,
  Plus,
  ReceiptText,
  RotateCcw,
  ScanLine,
  Sun,
  Trash2,
  Upload,
  Wallet,
  WifiOff,
  X,
} from 'lucide-react';
import { useLocalBudget } from './hooks/useLocalBudget';
import { ThemePreference, useTheme } from './hooks/useTheme';
import { useOnlineStatus } from './hooks/useOnlineStatus';
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
import { DocumentScannerView } from './components/DocumentScannerView';
import { EntryModal, ModalState } from './components/EntryModal';
import { PWAInstallButton } from './components/PWAInstallButton';

type NavTab = 'overview' | 'expenses' | 'income' | 'goals' | 'categories' | 'scan';

const NAV_ITEMS: { id: NavTab; label: string; shortLabel: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', shortLabel: 'Home', icon: LayoutDashboard },
  { id: 'expenses', label: 'Expenses', shortLabel: 'Expenses', icon: ReceiptText },
  { id: 'income', label: 'Income', shortLabel: 'Income', icon: Wallet },
  { id: 'goals', label: 'Savings Goals', shortLabel: 'Goals', icon: PiggyBank },
  { id: 'categories', label: 'Categories', shortLabel: 'Limits', icon: FolderKanban },
  { id: 'scan', label: 'Scan Document', shortLabel: 'Scan', icon: ScanLine },
];

const MOBILE_BOTTOM_NAV_ITEMS = NAV_ITEMS.filter((item) => item.id !== 'scan');

const TAB_TITLES: Record<NavTab, string> = {
  overview: 'Overview',
  expenses: 'Expenses',
  income: 'Income',
  goals: 'Savings Goals',
  categories: 'Categories',
  scan: 'Scan Document',
};

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Auto', icon: Monitor },
];

export default function App() {
  const {
    store,
    storageError,
    addExpense,
    updateExpense,
    deleteExpense,
    clearCategoryExpenses,
    clearAllExpenses,
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
    importScannedEntries,
  } = useLocalBudget();

  const { preference: themePreference, isDark, setPreference: setThemePreference, toggleTheme } =
    useTheme();
  const isOnline = useOnlineStatus();

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
      [
        'Type',
        'Title',
        'Category / Source',
        'Entered Amount (USD)',
        'Frequency',
        'Monthly Equivalent (USD)',
        'Notes',
      ],
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
        showFeedback('Budget backup restored into device storage.');
      } else {
        showFeedback(result.error ?? 'Could not import file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const renderSidebarContent = () => (
    <div className="h-full flex flex-col justify-between p-5 overflow-y-auto">
      <div>
        {/* Single-element Brand Wordmark */}
        <div className="flex items-center justify-between pb-5 mb-4 border-b border-[#D4E7F7] dark:border-[#1E3750]">
          <button
            type="button"
            onClick={() => handleNavigate('overview')}
            className="text-xl font-bold tracking-tight text-[#0C4A6E] dark:text-[#7DD3FC] whitespace-nowrap shrink-0 cursor-pointer"
          >
            ClearTerm
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
            className="lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center text-[#4B6780] dark:text-[#93B4CF] hover:text-[#0F2537] dark:hover:text-white rounded-lg cursor-pointer"
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
                className={`w-full min-h-[42px] flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-[#13293E] text-[#0C4A6E] dark:text-[#7DD3FC] border border-[#CBE2F5] dark:border-[#244564] shadow-2xs'
                    : 'text-[#3B5973] dark:text-[#9DBBD4] hover:bg-[#DFEFFB] dark:hover:bg-[#132639] hover:text-[#0F2537] dark:hover:text-white border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive
                      ? 'text-[#0284C7] dark:text-[#38BDF8]'
                      : 'text-[#5B7A96] dark:text-[#6D90AE]'
                  }`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Compact Monthly Cash Flow Readout */}
        <div className="mt-5 pt-4 border-t border-[#D4E7F7] dark:border-[#1E3750] space-y-2 text-xs">
          <div className="flex items-center justify-between text-[#4B6780] dark:text-[#93B4CF]">
            <span>Monthly Income</span>
            <span className="font-mono tabular-nums font-medium text-[#0F2537] dark:text-[#EDF6FF]">
              {formatCurrency(totalMonthlyIncome)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[#4B6780] dark:text-[#93B4CF]">
            <span>Monthly Expenses</span>
            <span className="font-mono tabular-nums font-medium text-[#0F2537] dark:text-[#EDF6FF]">
              {formatCurrency(totalMonthlyExpenses)}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[#D4E7F7] dark:border-[#1E3750]">
            <span className="font-medium text-[#0F2537] dark:text-[#EDF6FF]">Net Balance</span>
            <span
              className={`font-mono tabular-nums font-semibold ${
                monthlySurplus >= 0
                  ? 'text-[#0F766E] dark:text-[#2DD4BF]'
                  : 'text-[#BE123C] dark:text-[#FB7185]'
              }`}
            >
              {formatCurrency(monthlySurplus, true)}
            </span>
          </div>
        </div>

        {/* Appearance Theme Switcher */}
        <div className="mt-5 pt-4 border-t border-[#D4E7F7] dark:border-[#1E3750]">
          <div className="text-[11px] font-medium text-[#506E88] dark:text-[#7FA0BC] mb-2">
            Appearance
          </div>
          <div
            role="radiogroup"
            aria-label="Color theme"
            className="grid grid-cols-3 gap-1 p-1 bg-[#DFEFFB] dark:bg-[#091521] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg"
          >
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = themePreference === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setThemePreference(opt.value)}
                  className={`min-h-[34px] inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selected
                      ? 'bg-white dark:bg-[#17314A] text-[#0C4A6E] dark:text-[#7DD3FC] shadow-2xs'
                      : 'text-[#4B6780] dark:text-[#84A5C2] hover:text-[#0F2537] dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Android Install + Browser-Only Data Controls */}
      <div className="pt-5 mt-5 border-t border-[#D4E7F7] dark:border-[#1E3750] space-y-3">
        <PWAInstallButton />

        <p className="text-[11px] leading-relaxed text-[#506E88] dark:text-[#7FA0BC]">
          Saved only on this device. No account or remote server storage is used.
        </p>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={handleExportCsv}
            className="min-h-[36px] inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#0C4A6E] dark:text-[#93D5FB] bg-white dark:bg-[#112233] hover:bg-[#F5FAFF] dark:hover:bg-[#162E45] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="min-h-[36px] inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#0C4A6E] dark:text-[#93D5FB] bg-white dark:bg-[#112233] hover:bg-[#F5FAFF] dark:hover:bg-[#162E45] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
            className="min-h-[32px] inline-flex items-center gap-1 text-[#3B5973] dark:text-[#93B4CF] hover:text-[#0284C7] dark:hover:text-[#38BDF8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
              className="min-h-[32px] inline-flex items-center gap-1 text-[#0284C7] dark:text-[#38BDF8] hover:text-[#0369A1] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
                className="text-[#BE123C] dark:text-[#FB7185] font-semibold hover:underline cursor-pointer"
              >
                Confirm
              </button>
              <span className="text-[#94B4CE] dark:text-[#456787]" aria-hidden="true">/</span>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="text-[#4B6780] dark:text-[#93B4CF] hover:text-[#0F2537] dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="min-h-[32px] inline-flex items-center gap-1 text-[#4B6780] dark:text-[#93B4CF] hover:text-[#BE123C] dark:hover:text-[#FB7185] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
    <div className="min-h-[100dvh] bg-[#F2F8FD] dark:bg-[#08131E] text-[#0F2537] dark:text-[#EDF6FF] flex">
      {/* 1. Desktop Full Sidebar (lg and up) */}
      <aside className="hidden lg:block w-[252px] shrink-0 bg-[#EBF5FD] dark:bg-[#0D1C2B] border-r border-[#D4E7F7] dark:border-[#1E3750] sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* 2. Android Landscape Navigation Rail (replaces bottom bar on landscape phones/tablets to preserve vertical space) */}
      <aside
        aria-label="Landscape navigation rail"
        className="hidden max-lg:landscape:flex flex-col items-center justify-between w-[72px] shrink-0 bg-[#EBF5FD] dark:bg-[#0D1C2B] border-r border-[#D4E7F7] dark:border-[#1E3750] sticky top-0 h-[100dvh] py-2.5 safe-pl"
      >
        <div className="flex flex-col items-center gap-1 w-full px-1.5">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu and local backup options"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#0C4A6E] dark:text-[#7DD3FC] hover:bg-[#DFEFFB] dark:hover:bg-[#163049] transition-colors cursor-pointer mb-1"
          >
            <Menu className="w-5 h-5" />
          </button>

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full min-h-[46px] flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-[#163049] text-[#0284C7] dark:text-[#38BDF8] border border-[#CBE2F5] dark:border-[#254A6B]'
                    : 'text-[#4B6780] dark:text-[#8FB0CC] hover:bg-[#DFEFFB] dark:hover:bg-[#132639]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="text-[10px] font-medium leading-none truncate max-w-full">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-1.5 px-1.5">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#0C4A6E] dark:text-[#7DD3FC] hover:bg-[#DFEFFB] dark:hover:bg-[#163049] transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Mobile / Landscape Slide-Over Drawer (Settings, Backup, Install) */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-[#0F2537]/45 dark:bg-black/65 backdrop-blur-[1px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <aside className="w-[272px] max-w-[85vw] h-full bg-[#EBF5FD] dark:bg-[#0D1C2B] border-r border-[#D4E7F7] dark:border-[#1E3750] safe-pl">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Compact in Android landscape (h-12) and portrait (h-14), h-16 on desktop */}
        <header className="sticky top-0 z-30 bg-[#F2F8FD]/95 dark:bg-[#08131E]/95 backdrop-blur-xs border-b border-[#D4E7F7] dark:border-[#1E3750] px-4 sm:px-8 h-14 max-lg:landscape:h-12 lg:h-16 flex items-center justify-between gap-3 safe-pr">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden max-lg:landscape:hidden min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center text-[#0C4A6E] dark:text-[#7DD3FC] hover:bg-[#E1F0FC] dark:hover:bg-[#163049] rounded-lg transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-[#5B7A96] dark:text-[#7FA0BC] whitespace-nowrap shrink-0 hidden sm:inline">
                ClearTerm
              </span>
              <span
                className="text-[#94B4CE] dark:text-[#3A5A78] hidden sm:inline"
                aria-hidden="true"
              >
                /
              </span>
              <h1 className="font-semibold text-[#0F2537] dark:text-[#EDF6FF] truncate">
                {TAB_TITLES[activeTab]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Theme Toggle visible on mobile & desktop top bar */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="max-lg:landscape:hidden min-h-[40px] min-w-[40px] flex items-center justify-center text-[#0C4A6E] dark:text-[#7DD3FC] bg-white dark:bg-[#112233] hover:bg-[#EBF5FD] dark:hover:bg-[#163049] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('scan')}
              aria-current={activeTab === 'scan' ? 'page' : undefined}
              className={`min-h-[40px] max-lg:landscape:min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'scan'
                  ? 'bg-[#E0F2FE] dark:bg-[#13324D] text-[#0369A1] dark:text-[#7DD3FC] border-[#7DD3FC] dark:border-[#38BDF8]'
                  : 'text-[#0C4A6E] dark:text-[#7DD3FC] bg-white dark:bg-[#112233] hover:bg-[#EBF5FD] dark:hover:bg-[#163049] border-[#CBE2F5] dark:border-[#1E3750]'
              }`}
            >
              <ScanLine className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Scan Doc</span>
            </button>

            <button
              type="button"
              onClick={() => setModal({ type: 'income' })}
              className="hidden sm:inline-flex landscape:inline-flex min-h-[40px] max-lg:landscape:min-h-[34px] items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#0C4A6E] dark:text-[#7DD3FC] bg-white dark:bg-[#112233] hover:bg-[#EBF5FD] dark:hover:bg-[#163049] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Income
            </button>
            <button
              type="button"
              onClick={() => setModal({ type: 'expense' })}
              className="min-h-[40px] max-lg:landscape:min-h-[34px] inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 text-xs font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] dark:bg-[#0EA5E9] dark:text-[#08131E] dark:hover:bg-[#38BDF8] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Expense
            </button>
          </div>
        </header>

        {/* Main Scroll Area (bottom padding in portrait phone mode for fixed bottom nav) */}
        <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-8 py-5 sm:py-7 max-lg:landscape:py-4 max-lg:portrait:pb-24 safe-pr">
          {!isOnline && (
            <div
              role="status"
              className="mb-4 px-4 py-2.5 rounded-lg border bg-[#FEF3C7] dark:bg-[#2F2107] border-[#FDE68A] dark:border-[#78350F] text-[#92400E] dark:text-[#FCD34D] text-xs flex items-center gap-2"
            >
              <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Offline mode active — all changes are saved locally on your device.</span>
            </div>
          )}

          {(storageError || feedbackMsg) && (
            <div
              role="status"
              className={`mb-4 px-4 py-2.5 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                storageError
                  ? 'bg-[#FFF1F2] dark:bg-[#3B1020] border-[#FECDD3] dark:border-[#881337] text-[#9F1239] dark:text-[#FDA4AF]'
                  : 'bg-[#E0F2FE] dark:bg-[#0F2C44] border-[#BAE6FD] dark:border-[#1E4B6E] text-[#0C4A6E] dark:text-[#7DD3FC]'
              }`}
            >
              <span>{storageError ?? feedbackMsg}</span>
              <button
                type="button"
                onClick={() => setFeedbackMsg(null)}
                aria-label="Dismiss notification"
                className="min-h-[28px] min-w-[28px] flex items-center justify-center text-current opacity-70 hover:opacity-100 cursor-pointer"
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
              isDark={isDark}
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
              onClearCategory={(catId, catName) => {
                clearCategoryExpenses(catId);
                showFeedback(`Cleared all ${catName} expenses.`);
              }}
              onClearAllData={() => {
                clearAllEntries();
                showFeedback('Cleared all local budget data.');
              }}
              onLoadSampleData={() => {
                loadSampleData();
                showFeedback('Sample student budget loaded.');
              }}
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
              onClearCategory={(catId, catName) => {
                clearCategoryExpenses(catId);
                showFeedback(`Cleared all ${catName} expenses.`);
              }}
              onClearAllExpenses={() => {
                clearAllExpenses();
                showFeedback('Cleared all expenses.');
              }}
              onOpenScanner={() => handleNavigate('scan')}
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
              onClearCategory={(catId, catName) => {
                clearCategoryExpenses(catId);
                showFeedback(`Cleared all ${catName} expenses.`);
              }}
              onClearAllData={() => {
                clearAllEntries();
                showFeedback('Cleared all local budget data.');
              }}
            />
          )}
          {activeTab === 'scan' && (
            <DocumentScannerView
              categories={store.categories}
              isOnline={isOnline}
              onImportEntries={(expensesToAdd, incomesToAdd) => {
                importScannedEntries(expensesToAdd, incomesToAdd);
                const totalImported = expensesToAdd.length + incomesToAdd.length;
                showFeedback(
                  `Imported ${totalImported} scanned ${totalImported === 1 ? 'item' : 'items'} into your local budget.`
                );
              }}
              onNavigateOverview={() => handleNavigate('overview')}
              onNavigateExpenses={() => handleNavigate('expenses')}
            />
          )}
        </main>
      </div>

      {/* 3. Android Portrait Bottom Navigation Bar (thumb-zone friendly; automatically hidden in landscape & desktop) */}
      <nav
        aria-label="Mobile navigation"
        className="hidden max-lg:portrait:grid grid-cols-5 fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0D1C2B]/95 backdrop-blur-md border-t border-[#D4E7F7] dark:border-[#1E3750] safe-pb"
      >
        {MOBILE_BOTTOM_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`min-h-[58px] flex flex-col items-center justify-center gap-1 px-1 transition-colors cursor-pointer ${
                isActive
                  ? 'text-[#0284C7] dark:text-[#38BDF8]'
                  : 'text-[#5B7A96] dark:text-[#7FA0BC]'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span className="text-[10px] font-medium leading-none tracking-tight whitespace-nowrap">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>

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
