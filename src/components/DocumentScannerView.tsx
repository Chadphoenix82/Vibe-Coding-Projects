import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  CheckSquare,
  ClipboardPaste,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Landmark,
  Loader2,
  ScanLine,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  BudgetCategory,
  ExpenseItem,
  FREQUENCY_META,
  Frequency,
  INCOME_SOURCE_LABELS,
  IncomeItem,
  IncomeSourceType,
  ScanDocumentResponse,
  ScannedFinancialItem,
  formatCurrency,
  toMonthlyAmount,
} from '../types/budget';

interface DocumentScannerViewProps {
  categories: BudgetCategory[];
  isOnline: boolean;
  onImportEntries: (
    expenses: Omit<ExpenseItem, 'id'>[],
    incomes: Omit<IncomeItem, 'id'>[]
  ) => void;
  onNavigateOverview: () => void;
  onNavigateExpenses: () => void;
}

const ACCEPTED_FILE_EXTENSIONS =
  '.pdf,.xlsx,.xlsm,.xls,.ods,.csv,.tsv,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.bmp,.ofx,.qfx,.qif,.mt940,.sta,.docx,.odt,.rtf,.txt,.md,.json,.xml,.html,.htm';

const FORMAT_GROUPS = [
  {
    title: 'PDF Documents',
    extensions: 'PDF',
    detail: 'Bank statements, credit card bills, tuition invoices, pay stubs',
    icon: FileText,
  },
  {
    title: 'Spreadsheets',
    extensions: 'XLSX · XLS · XLSM · ODS · CSV · TSV',
    detail: 'Excel workbooks, Google Sheets exports, LibreOffice & budget tables',
    icon: FileSpreadsheet,
  },
  {
    title: 'Receipts & Photos',
    extensions: 'PNG · JPG · WebP · HEIC · GIF',
    detail: 'Camera photos of paper receipts or banking app screenshots',
    icon: ImageIcon,
  },
  {
    title: 'Bank & Doc Exports',
    extensions: 'OFX · QFX · QIF · DOCX · ODT · RTF · JSON · XML · TXT',
    detail: 'Quicken / bank downloads, Word tables, structured exports & logs',
    icon: Landmark,
  },
];

const FREQUENCY_OPTIONS: { value: Frequency | 'auto'; label: string }[] = [
  { value: 'auto', label: 'Auto-detect from document' },
  { value: 'monthly', label: 'Default to Monthly' },
  { value: 'onetime', label: 'Default to One-time' },
  { value: 'weekly', label: 'Default to Weekly' },
  { value: 'biweekly', label: 'Default to Bi-weekly' },
  { value: 'semester', label: 'Default to Per Semester' },
  { value: 'annual', label: 'Default to Annual' },
];

type InputMode = 'upload' | 'paste';
type ReviewFilter = 'all' | 'expense' | 'income';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DocumentScannerView({
  categories,
  isOnline,
  onImportEntries,
  onNavigateOverview,
  onNavigateExpenses,
}: DocumentScannerViewProps) {
  const [inputMode, setInputMode] = useState<InputMode>('upload');
  const [frequencyHint, setFrequencyHint] = useState<Frequency | 'auto'>('auto');
  const [pastedText, setPastedText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanningFileLabel, setScanningFileLabel] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [scanResult, setScanResult] = useState<ScanDocumentResponse | null>(null);
  const [items, setItems] = useState<ScannedFinancialItem[]>([]);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [bulkCategoryId, setBulkCategoryId] = useState<string>(categories[0]?.id ?? 'food');
  const [importedSummary, setImportedSummary] = useState<{
    expensesCount: number;
    incomesCount: number;
    fileName: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const defaultCategoryId = categories[0]?.id ?? 'food';

  const scanFile = async (file: File) => {
    if (!isOnline) {
      setErrorMsg('You appear to be offline. Connect to the internet to scan financial documents.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('This file exceeds the 15 MB limit. Please upload a smaller document.');
      return;
    }

    setErrorMsg(null);
    setImportedSummary(null);
    setIsScanning(true);
    setScanningFileLabel(`${file.name} (${formatFileSize(file.size)})`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append(
        'categories',
        JSON.stringify(
          categories.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
          }))
        )
      );
      formData.append('frequencyHint', frequencyHint);

      const response = await fetch('/api/scan-document', {
        method: 'POST',
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as
        | (ScanDocumentResponse & { error?: string })
        | null;

      if (!response.ok || !payload) {
        throw new Error(
          payload?.error ?? `Document scan failed (status ${response.status}). Please try again.`
        );
      }

      setScanResult(payload);
      setItems(payload.items ?? []);
      setReviewFilter('all');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to scan this document.');
    } finally {
      setIsScanning(false);
      setScanningFileLabel(null);
    }
  };

  const scanPastedData = async () => {
    const trimmed = pastedText.trim();
    if (!trimmed) {
      setErrorMsg('Paste spreadsheet rows, CSV text, or statement lines before scanning.');
      return;
    }
    if (!isOnline) {
      setErrorMsg('You appear to be offline. Connect to the internet to scan financial data.');
      return;
    }

    setErrorMsg(null);
    setImportedSummary(null);
    setIsScanning(true);
    setScanningFileLabel('Pasted Financial Data');

    try {
      const response = await fetch('/api/scan-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pastedText: trimmed,
          fileName: 'Pasted Financial Table',
          categories: categories.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
          })),
          frequencyHint,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | (ScanDocumentResponse & { error?: string })
        | null;

      if (!response.ok || !payload) {
        throw new Error(
          payload?.error ?? `Scan failed (status ${response.status}). Please try again.`
        );
      }

      setScanResult(payload);
      setItems(payload.items ?? []);
      setReviewFilter('all');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to parse pasted financial data.');
    } finally {
      setIsScanning(false);
      setScanningFileLabel(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void scanFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void scanFile(file);
    }
  };

  const visibleItems = useMemo(() => {
    if (reviewFilter === 'all') return items;
    return items.filter((item) => item.entryType === reviewFilter);
  }, [items, reviewFilter]);

  const stats = useMemo(() => {
    const selected = items.filter((i) => i.selected);
    const selectedExpenses = selected.filter((i) => i.entryType === 'expense');
    const selectedIncomes = selected.filter((i) => i.entryType === 'income');

    const expenseMonthly = selectedExpenses.reduce(
      (sum, i) => sum + toMonthlyAmount(i.amount, i.frequency),
      0
    );
    const incomeMonthly = selectedIncomes.reduce(
      (sum, i) => sum + toMonthlyAmount(i.amount, i.frequency),
      0
    );

    return {
      totalCount: items.length,
      selectedCount: selected.length,
      expenseCount: items.filter((i) => i.entryType === 'expense').length,
      incomeCount: items.filter((i) => i.entryType === 'income').length,
      selectedExpenseCount: selectedExpenses.length,
      selectedIncomeCount: selectedIncomes.length,
      expenseMonthly,
      incomeMonthly,
    };
  }, [items]);

  const updateItem = (id: string, patch: Partial<ScannedFinancialItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const toggleAllVisible = () => {
    const allSelected = visibleItems.length > 0 && visibleItems.every((i) => i.selected);
    const visibleIds = new Set(visibleItems.map((i) => i.id));
    setItems((prev) =>
      prev.map((item) =>
        visibleIds.has(item.id) ? { ...item, selected: !allSelected } : item
      )
    );
  };

  const applyBulkCategory = () => {
    if (!bulkCategoryId) return;
    setItems((prev) =>
      prev.map((item) =>
        item.selected && item.entryType === 'expense'
          ? { ...item, categoryId: bulkCategoryId }
          : item
      )
    );
  };

  const handleConfirmImport = () => {
    const selected = items.filter((i) => i.selected && i.amount > 0 && i.title.trim().length > 0);
    if (selected.length === 0) return;

    const validCategoryIds = new Set(categories.map((c) => c.id));

    const expensesToAdd: Omit<ExpenseItem, 'id'>[] = selected
      .filter((i) => i.entryType === 'expense')
      .map((i) => ({
        title: i.title.trim(),
        categoryId: validCategoryIds.has(i.categoryId) ? i.categoryId : defaultCategoryId,
        amount: Number(Math.abs(i.amount).toFixed(2)),
        frequency: i.frequency,
        date: i.date || new Date().toISOString().slice(0, 10),
        note: i.note?.trim() || (scanResult ? `Scanned from ${scanResult.fileName}` : undefined),
      }));

    const incomesToAdd: Omit<IncomeItem, 'id'>[] = selected
      .filter((i) => i.entryType === 'income')
      .map((i) => ({
        title: i.title.trim(),
        sourceType: i.sourceType,
        amount: Number(Math.abs(i.amount).toFixed(2)),
        frequency: i.frequency,
        active: true,
        note: i.note?.trim() || (scanResult ? `Scanned from ${scanResult.fileName}` : undefined),
      }));

    onImportEntries(expensesToAdd, incomesToAdd);
    setImportedSummary({
      expensesCount: expensesToAdd.length,
      incomesCount: incomesToAdd.length,
      fileName: scanResult?.fileName ?? 'Financial Document',
    });
    setScanResult(null);
    setItems([]);
    setPastedText('');
  };

  const resetScanner = () => {
    setScanResult(null);
    setItems([]);
    setErrorMsg(null);
    setImportedSummary(null);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header Card */}
      <section className="bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
              Financial Document Scanner
            </h2>
            <p className="text-xs sm:text-sm text-[#4B6780] dark:text-[#93B4CF] mt-1">
              Scan PDF statements, Excel/CSV/ODS spreadsheets, receipt photos, or bank exports to
              extract and categorize expenses and income automatically. Review every row before
              saving to your device.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label
              htmlFor="scan-frequency-hint"
              className="text-xs text-[#4B6780] dark:text-[#93B4CF] whitespace-nowrap"
            >
              Cadence
            </label>
            <select
              id="scan-frequency-hint"
              value={frequencyHint}
              onChange={(e) => setFrequencyHint(e.target.value as Frequency | 'auto')}
              disabled={isScanning}
              className="min-h-[38px] px-3 py-1.5 text-xs font-medium bg-[#F8FBFE] dark:bg-[#0B1825] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg text-[#0F2537] dark:text-[#EDF6FF] focus:border-[#0284C7] dark:focus:border-[#38BDF8] focus:outline-none"
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mode Tabs: Upload File vs Paste Table */}
        {!scanResult && (
          <div className="mt-5">
            <div
              role="tablist"
              aria-label="Document input method"
              className="inline-flex items-center p-1 bg-[#EBF5FD] dark:bg-[#0B1825] rounded-lg border border-[#D4E7F7] dark:border-[#1E3750]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={inputMode === 'upload'}
                onClick={() => {
                  setInputMode('upload');
                  setErrorMsg(null);
                }}
                className={`min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  inputMode === 'upload'
                    ? 'bg-white dark:bg-[#183148] text-[#0C4A6E] dark:text-[#7DD3FC] shadow-2xs'
                    : 'text-[#4B6780] dark:text-[#8FB0CC] hover:text-[#0F2537] dark:hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                Upload File
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={inputMode === 'paste'}
                onClick={() => {
                  setInputMode('paste');
                  setErrorMsg(null);
                }}
                className={`min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  inputMode === 'paste'
                    ? 'bg-white dark:bg-[#183148] text-[#0C4A6E] dark:text-[#7DD3FC] shadow-2xs'
                    : 'text-[#4B6780] dark:text-[#8FB0CC] hover:text-[#0F2537] dark:hover:text-white'
                }`}
              >
                <ClipboardPaste className="w-3.5 h-3.5" aria-hidden="true" />
                Paste Spreadsheet / Text
              </button>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div
            role="alert"
            className="mt-4 px-4 py-3 rounded-lg border bg-[#FFF1F2] dark:bg-[#3B1020] border-[#FECDD3] dark:border-[#881337] text-[#9F1239] dark:text-[#FDA4AF] text-xs sm:text-sm flex items-start gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Post-Import Confirmation Banner */}
        {importedSummary && !scanResult && !isScanning && (
          <div className="mt-4 p-4 rounded-xl border bg-[#ECFDF5] dark:bg-[#0B2E26] border-[#A7F3D0] dark:border-[#115E49] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#0F766E] text-white flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#064E3B] dark:text-[#A7F3D0]">
                  Imported from {importedSummary.fileName}
                </div>
                <p className="text-xs text-[#047857] dark:text-[#6EE7B7] mt-0.5">
                  Added{' '}
                  <span className="font-mono tabular-nums font-semibold">
                    {importedSummary.expensesCount}
                  </span>{' '}
                  {importedSummary.expensesCount === 1 ? 'expense' : 'expenses'} and{' '}
                  <span className="font-mono tabular-nums font-semibold">
                    {importedSummary.incomesCount}
                  </span>{' '}
                  income {importedSummary.incomesCount === 1 ? 'source' : 'sources'} to your local
                  device budget.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onNavigateExpenses}
                className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-[#065F46] dark:text-[#A7F3D0] bg-white dark:bg-[#103E32] border border-[#A7F3D0] dark:border-[#1D6B55] rounded-lg hover:bg-[#D1FAE5] dark:hover:bg-[#155040] transition-colors whitespace-nowrap cursor-pointer"
              >
                View Expenses
              </button>
              <button
                type="button"
                onClick={onNavigateOverview}
                className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0F766E] hover:bg-[#0D9488] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Overview
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Active Scanning State */}
        {isScanning && (
          <div className="mt-5 py-12 px-6 rounded-xl border border-[#BAE6FD] dark:border-[#1E4B6E] bg-[#F5FAFF] dark:bg-[#0D1C2B] flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-[#E0F2FE] dark:bg-[#14304B] text-[#0284C7] dark:text-[#38BDF8] flex items-center justify-center mb-3.5">
              <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
              Scanning Financial Document
            </h3>
            {scanningFileLabel && (
              <p className="text-xs font-mono text-[#0369A1] dark:text-[#7DD3FC] mt-1 max-w-md truncate">
                {scanningFileLabel}
              </p>
            )}
            <p className="text-xs text-[#4B6780] dark:text-[#93B4CF] mt-2 max-w-md">
              Parsing tables, receipts, and line items, then matching each transaction to your
              student budget categories...
            </p>
          </div>
        )}

        {/* Upload Dropzone */}
        {!isScanning && !scanResult && inputMode === 'upload' && (
          <div className="mt-5 space-y-5">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_EXTENSIONS}
              onChange={handleFileChange}
              className="hidden"
              aria-label="Upload financial document"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Capture receipt photo with camera"
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed p-7 sm:p-10 text-center transition-colors ${
                isDragging
                  ? 'border-[#0284C7] dark:border-[#38BDF8] bg-[#EBF5FD] dark:bg-[#132C44]'
                  : 'border-[#BDD8F0] dark:border-[#24435F] bg-[#F8FBFE] dark:bg-[#0B1825] hover:border-[#7CC3EC] dark:hover:border-[#38BDF8]/70'
              }`}
            >
              <div className="w-12 h-12 mx-auto rounded-xl bg-[#E0F2FE] dark:bg-[#132E47] text-[#0284C7] dark:text-[#38BDF8] flex items-center justify-center mb-3.5">
                <ScanLine className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
                Drop a financial file here, or choose from your device
              </h3>
              <p className="text-xs text-[#4B6780] dark:text-[#93B4CF] mt-1 max-w-lg mx-auto">
                Supports PDF statements, Excel &amp; CSV spreadsheets, receipt photos, Word docs,
                and bank downloads up to 15 MB.
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!isOnline}
                  className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] dark:bg-[#0EA5E9] dark:text-[#08131E] dark:hover:bg-[#38BDF8] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  Choose Document
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={!isOnline}
                  className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium text-[#0C4A6E] dark:text-[#7DD3FC] bg-white dark:bg-[#112233] hover:bg-[#EBF5FD] dark:hover:bg-[#163049] border border-[#CBE2F5] dark:border-[#1E3750] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Camera className="w-4 h-4" aria-hidden="true" />
                  Scan Receipt Photo
                </button>
              </div>
            </div>

            {/* Supported Formats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 landscape:grid-cols-2 xl:grid-cols-4 gap-3">
              {FORMAT_GROUPS.map((group) => {
                const Icon = group.icon;
                return (
                  <div
                    key={group.title}
                    className="p-3.5 rounded-lg bg-[#F5FAFF] dark:bg-[#0D1C2B] border border-[#E0EFFA] dark:border-[#1A3046]"
                  >
                    <div className="flex items-center gap-2 text-[#0C4A6E] dark:text-[#7DD3FC]">
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="text-xs font-semibold">{group.title}</span>
                    </div>
                    <div className="mt-1.5 font-mono text-[10px] font-medium text-[#0284C7] dark:text-[#38BDF8] tracking-tight">
                      {group.extensions}
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-[#4B6780] dark:text-[#93B4CF]">
                      {group.detail}
                    </p>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-[#506E88] dark:text-[#7FA0BC]">
              Files are parsed in memory to extract line items and are never stored on a server.
              Confirmed entries are saved exclusively in your local browser storage.
            </p>
          </div>
        )}

        {/* Paste Spreadsheet / Text Mode */}
        {!isScanning && !scanResult && inputMode === 'paste' && (
          <div className="mt-5 space-y-3">
            <label
              htmlFor="pasted-financial-data"
              className="block text-xs font-medium text-[#0F2537] dark:text-[#EDF6FF]"
            >
              Paste copied cells from Excel, Google Sheets, CSV, or bank statement text
            </label>
            <textarea
              id="pasted-financial-data"
              rows={7}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={`Example:\n2026-11-02\tTrader Joe's Groceries\t-$64.20\n2026-11-05\tCampus Bookstore Lab Manual\t-$42.50\n2026-11-10\tPart-Time Library Payroll\t+$340.00`}
              className="w-full p-3.5 text-xs sm:text-sm font-mono bg-[#F8FBFE] dark:bg-[#0B1825] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg text-[#0F2537] dark:text-[#EDF6FF] placeholder:text-[#7E9BB5] dark:placeholder:text-[#5E7E9B] focus:bg-white dark:focus:bg-[#0D1E2E] focus:border-[#0284C7] dark:focus:border-[#38BDF8] focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[#4B6780] dark:text-[#93B4CF]">
                Tab-separated, comma-separated, or plain text rows are all supported.
              </span>
              <button
                type="button"
                onClick={() => void scanPastedData()}
                disabled={!isOnline || !pastedText.trim()}
                className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] dark:bg-[#0EA5E9] dark:text-[#08131E] dark:hover:bg-[#38BDF8] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <ScanLine className="w-4 h-4" aria-hidden="true" />
                Scan Pasted Data
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Review & Import Section */}
      {scanResult && !isScanning && (
        <section className="bg-white dark:bg-[#112233] border border-[#D4E7F7] dark:border-[#1E3750] rounded-xl overflow-hidden">
          {/* Result Header */}
          <div className="px-5 sm:px-6 py-4 bg-[#F5FAFF] dark:bg-[#0D1C2B] border-b border-[#D4E7F7] dark:border-[#1E3750] flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#4B6780] dark:text-[#93B4CF]">
                <span className="font-semibold text-[#0C4A6E] dark:text-[#7DD3FC]">
                  {scanResult.documentType}
                </span>
                <span aria-hidden="true">·</span>
                <span>{scanResult.formatLabel}</span>
                {scanResult.metadataSummary && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{scanResult.metadataSummary}</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="font-mono">{scanResult.currency}</span>
              </div>
              <h3 className="text-base font-semibold text-[#0F2537] dark:text-[#EDF6FF] mt-0.5 truncate">
                {scanResult.fileName}
              </h3>
              <p className="text-xs text-[#4B6780] dark:text-[#93B4CF] mt-1">
                {scanResult.summary}
              </p>
            </div>

            <button
              type="button"
              onClick={resetScanner}
              className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-[#0C4A6E] dark:text-[#7DD3FC] bg-white dark:bg-[#112233] hover:bg-[#EBF5FD] dark:hover:bg-[#163049] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Scan Another File
            </button>
          </div>

          {/* Warnings */}
          {scanResult.warnings.length > 0 && (
            <div className="px-5 sm:px-6 py-3 bg-[#FFFBEB] dark:bg-[#2F2107] border-b border-[#FDE68A] dark:border-[#78350F] space-y-1">
              {scanResult.warnings.map((w, i) => (
                <div
                  key={i}
                  className="text-xs text-[#92400E] dark:text-[#FCD34D] flex items-start gap-2"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Toolbar: Filter + Bulk Select + Bulk Category */}
          {items.length > 0 ? (
            <>
              <div className="px-5 sm:px-6 py-3 border-b border-[#E6F1FA] dark:border-[#1A3046] flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleAllVisible}
                    className="min-h-[34px] inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#0F2537] dark:text-[#EDF6FF] bg-[#F5FAFF] dark:bg-[#0D1C2B] hover:bg-[#EBF5FD] dark:hover:bg-[#163049] border border-[#D4E7F7] dark:border-[#1E3750] rounded-lg transition-colors cursor-pointer"
                  >
                    {visibleItems.length > 0 && visibleItems.every((i) => i.selected) ? (
                      <CheckSquare className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#38BDF8]" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-[#6B87A1]" />
                    )}
                    {visibleItems.length > 0 && visibleItems.every((i) => i.selected)
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>

                  <div className="inline-flex items-center gap-1">
                    {(['all', 'expense', 'income'] as ReviewFilter[]).map((f) => {
                      const count =
                        f === 'all'
                          ? stats.totalCount
                          : f === 'expense'
                          ? stats.expenseCount
                          : stats.incomeCount;
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setReviewFilter(f)}
                          className={`min-h-[34px] px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                            reviewFilter === f
                              ? 'bg-[#0284C7] dark:bg-[#0EA5E9] text-white dark:text-[#08131E]'
                              : 'bg-[#EBF5FD] dark:bg-[#162C42] text-[#33516B] dark:text-[#B8D2E8] hover:bg-[#DCEEFB] dark:hover:bg-[#1E3B57]'
                          }`}
                        >
                          {f === 'all' ? 'All' : f === 'expense' ? 'Expenses' : 'Income'} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {stats.selectedExpenseCount > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-[#4B6780] dark:text-[#93B4CF] whitespace-nowrap">
                      Set expenses to
                    </span>
                    <select
                      aria-label="Bulk assign category to selected expenses"
                      value={bulkCategoryId}
                      onChange={(e) => setBulkCategoryId(e.target.value)}
                      className="min-h-[34px] px-2.5 py-1 text-xs bg-[#F8FBFE] dark:bg-[#0B1825] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg text-[#0F2537] dark:text-[#EDF6FF]"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={applyBulkCategory}
                      className="min-h-[34px] px-2.5 py-1 text-xs font-medium text-[#0C4A6E] dark:text-[#7DD3FC] bg-[#EBF5FD] dark:bg-[#163049] hover:bg-[#DCEEFB] dark:hover:bg-[#1D3E5E] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>

              {/* Editable Extracted Entries */}
              <div className="divide-y divide-[#EAF3FB] dark:divide-[#1A3046]">
                {visibleItems.map((item) => {
                  const monthlyVal = toMonthlyAmount(item.amount, item.frequency);
                  return (
                    <div
                      key={item.id}
                      className={`px-4 sm:px-6 py-3.5 transition-colors ${
                        item.selected
                          ? 'bg-white dark:bg-[#112233]'
                          : 'bg-[#FAFDFE] dark:bg-[#0C1A27] opacity-60'
                      }`}
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-[auto_92px_minmax(160px,1.5fr)_minmax(140px,1fr)_110px_132px_118px_auto] gap-2.5 items-center">
                        {/* Include Checkbox */}
                        <div className="flex items-center justify-between lg:justify-center gap-2">
                          <label className="inline-flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={(e) => updateItem(item.id, { selected: e.target.checked })}
                              aria-label={`Select ${item.title}`}
                              className="w-4 h-4 accent-[#0284C7] rounded cursor-pointer"
                            />
                            <span className="lg:hidden text-xs font-medium text-[#4B6780] dark:text-[#93B4CF]">
                              Include
                            </span>
                          </label>

                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            aria-label={`Remove ${item.title}`}
                            className="lg:hidden min-h-[34px] min-w-[34px] inline-flex items-center justify-center text-[#4B6780] dark:text-[#93B4CF] hover:text-[#BE123C] dark:hover:text-[#FB7185] rounded-md cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Type Toggle */}
                        <button
                          type="button"
                          onClick={() =>
                            updateItem(item.id, {
                              entryType: item.entryType === 'expense' ? 'income' : 'expense',
                            })
                          }
                          className={`min-h-[36px] px-2.5 py-1 text-xs font-medium rounded-lg border text-center transition-colors cursor-pointer ${
                            item.entryType === 'income'
                              ? 'bg-[#ECFDF5] dark:bg-[#0B2E26] border-[#A7F3D0] dark:border-[#115E49] text-[#0F766E] dark:text-[#2DD4BF]'
                              : 'bg-[#F5FAFF] dark:bg-[#0D1C2B] border-[#CBE2F5] dark:border-[#1E3750] text-[#0C4A6E] dark:text-[#7DD3FC]'
                          }`}
                        >
                          {item.entryType === 'income' ? 'Income' : 'Expense'}
                        </button>

                        {/* Editable Title + Note */}
                        <div className="space-y-1 min-w-0">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => updateItem(item.id, { title: e.target.value })}
                            aria-label="Transaction title"
                            className="w-full min-h-[36px] px-2.5 py-1 text-xs sm:text-sm font-medium bg-[#F8FBFE] dark:bg-[#0B1825] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg text-[#0F2537] dark:text-[#EDF6FF] focus:bg-white dark:focus:bg-[#0D1E2E] focus:border-[#0284C7] dark:focus:border-[#38BDF8] focus:outline-none"
                          />
                          {item.note && (
                            <div className="text-[11px] text-[#607D96] dark:text-[#7496B5] truncate px-1">
                              {item.note}
                            </div>
                          )}
                        </div>

                        {/* Category / Income Source */}
                        {item.entryType === 'expense' ? (
                          <select
                            aria-label={`Category for ${item.title}`}
                            value={item.categoryId}
                            onChange={(e) => updateItem(item.id, { categoryId: e.target.value })}
                            className="w-full min-h-[36px] px-2.5 py-1 text-xs bg-[#F8FBFE] dark:bg-[#0B1825] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg text-[#0F2537] dark:text-[#EDF6FF] focus:border-[#0284C7] dark:focus:border-[#38BDF8] focus:outline-none"
                          >
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            aria-label={`Income source for ${item.title}`}
                            value={item.sourceType}
                            onChange={(e) =>
                              updateItem(item.id, {
                                sourceType: e.target.value as IncomeSourceType,
                              })
                            }
                            className="w-full min-h-[36px] px-2.5 py-1 text-xs bg-[#F8FBFE] dark:bg-[#0B1825] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg text-[#0F2537] dark:text-[#EDF6FF] focus:border-[#0284C7] dark:focus:border-[#38BDF8] focus:outline-none"
                          >
                            {(Object.keys(INCOME_SOURCE_LABELS) as IncomeSourceType[]).map(
                              (key) => (
                                <option key={key} value={key}>
                                  {INCOME_SOURCE_LABELS[key]}
                                </option>
                              )
                            )}
                          </select>
                        )}

                        {/* Amount */}
                        <div className="relative">
                          <span
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[#607D96] dark:text-[#7496B5]"
                            aria-hidden="true"
                          >
                            $
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            inputMode="decimal"
                            aria-label={`Amount for ${item.title}`}
                            value={item.amount}
                            onChange={(e) => {
                              const parsed = parseFloat(e.target.value);
                              updateItem(item.id, {
                                amount: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
                              });
                            }}
                            className="w-full min-h-[36px] pl-6 pr-2 py-1 text-xs sm:text-sm font-mono tabular-nums text-right bg-[#F8FBFE] dark:bg-[#0B1825] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg text-[#0F2537] dark:text-[#EDF6FF] focus:bg-white dark:focus:bg-[#0D1E2E] focus:border-[#0284C7] dark:focus:border-[#38BDF8] focus:outline-none"
                          />
                        </div>

                        {/* Frequency */}
                        <div className="space-y-0.5">
                          <select
                            aria-label={`Frequency for ${item.title}`}
                            value={item.frequency}
                            onChange={(e) =>
                              updateItem(item.id, { frequency: e.target.value as Frequency })
                            }
                            className="w-full min-h-[36px] px-2 py-1 text-xs bg-[#F8FBFE] dark:bg-[#0B1825] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg text-[#0F2537] dark:text-[#EDF6FF] focus:border-[#0284C7] dark:focus:border-[#38BDF8] focus:outline-none"
                          >
                            {(Object.keys(FREQUENCY_META) as Frequency[]).map((freq) => (
                              <option key={freq} value={freq}>
                                {FREQUENCY_META[freq].label}
                              </option>
                            ))}
                          </select>
                          {item.frequency !== 'monthly' && item.frequency !== 'onetime' && (
                            <div className="text-[10px] font-mono tabular-nums text-[#4B6780] dark:text-[#93B4CF] text-right pr-1">
                              {formatCurrency(monthlyVal)}/mo
                            </div>
                          )}
                        </div>

                        {/* Date */}
                        <input
                          type="date"
                          aria-label={`Date for ${item.title}`}
                          value={item.date}
                          onChange={(e) => updateItem(item.id, { date: e.target.value })}
                          className="w-full min-h-[36px] px-2 py-1 text-xs font-mono bg-[#F8FBFE] dark:bg-[#0B1825] border border-[#CBE2F5] dark:border-[#1E3750] rounded-lg text-[#0F2537] dark:text-[#EDF6FF] focus:border-[#0284C7] dark:focus:border-[#38BDF8] focus:outline-none"
                        />

                        {/* Remove Row (Desktop) */}
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          aria-label={`Remove ${item.title}`}
                          className="hidden lg:inline-flex min-h-[34px] min-w-[34px] items-center justify-center text-[#4B6780] dark:text-[#93B4CF] hover:text-[#BE123C] dark:hover:text-[#FB7185] hover:bg-[#FFF1F2] dark:hover:bg-[#3B1020] rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer Import Bar */}
              <div className="px-5 sm:px-6 py-4 bg-[#F5FAFF] dark:bg-[#0D1C2B] border-t border-[#D4E7F7] dark:border-[#1E3750] flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
                  <div>
                    <span className="text-[#4B6780] dark:text-[#93B4CF]">Selected Expenses: </span>
                    <span className="font-mono tabular-nums font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
                      {stats.selectedExpenseCount} ({formatCurrency(stats.expenseMonthly)}/mo)
                    </span>
                  </div>
                  <div>
                    <span className="text-[#4B6780] dark:text-[#93B4CF]">Selected Income: </span>
                    <span className="font-mono tabular-nums font-semibold text-[#0F766E] dark:text-[#2DD4BF]">
                      {stats.selectedIncomeCount} ({formatCurrency(stats.incomeMonthly)}/mo)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={resetScanner}
                    className="min-h-[40px] px-3.5 py-2 text-xs font-medium text-[#4B6780] dark:text-[#93B4CF] hover:text-[#0F2537] dark:hover:text-white rounded-lg cursor-pointer"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={stats.selectedCount === 0}
                    className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] dark:bg-[#0EA5E9] dark:text-[#08131E] dark:hover:bg-[#38BDF8] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    Import {stats.selectedCount}{' '}
                    {stats.selectedCount === 1 ? 'Item' : 'Items'} to Budget
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-10 text-center">
              <h4 className="text-sm font-semibold text-[#0F2537] dark:text-[#EDF6FF]">
                No financial transactions detected
              </h4>
              <p className="text-xs text-[#4B6780] dark:text-[#93B4CF] mt-1 max-w-md mx-auto">
                We couldn&apos;t find clear expense or income amounts in this document. Try
                uploading a clearer PDF, spreadsheet, or receipt photo, or paste the rows directly.
              </p>
              <button
                type="button"
                onClick={resetScanner}
                className="mt-4 min-h-[38px] px-4 py-2 text-xs font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] dark:bg-[#0EA5E9] dark:text-[#08131E] rounded-lg transition-colors cursor-pointer"
              >
                Try Another File
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
