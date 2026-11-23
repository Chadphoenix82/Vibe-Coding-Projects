export type Frequency =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'semester'
  | 'annual'
  | 'onetime';

export type IncomeSourceType =
  | 'part-time-job'
  | 'parental-support'
  | 'scholarship'
  | 'freelance'
  | 'financial-aid'
  | 'other';

export interface BudgetCategory {
  id: string;
  name: string;
  color: string;
  monthlyTarget: number;
  isDefault?: boolean;
  description?: string;
}

export interface ExpenseItem {
  id: string;
  title: string;
  categoryId: string;
  amount: number;
  frequency: Frequency;
  date: string;
  note?: string;
}

export interface IncomeItem {
  id: string;
  title: string;
  sourceType: IncomeSourceType;
  amount: number;
  frequency: Frequency;
  active: boolean;
  note?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  monthlyAllocation: number;
  color: string;
  targetDate?: string;
  note?: string;
}

export interface BudgetStore {
  version: number;
  categories: BudgetCategory[];
  expenses: ExpenseItem[];
  incomes: IncomeItem[];
  savingsGoals: SavingsGoal[];
  currency: string;
}

export interface FrequencyMeta {
  label: string;
  shortLabel: string;
  monthlyMultiplier: number;
  formulaHint: string;
}

export const FREQUENCY_META: Record<Frequency, FrequencyMeta> = {
  weekly: {
    label: 'Weekly',
    shortLabel: '/ wk',
    monthlyMultiplier: 52 / 12,
    formulaHint: '× 52 ÷ 12 mo',
  },
  biweekly: {
    label: 'Bi-weekly',
    shortLabel: '/ 2 wk',
    monthlyMultiplier: 26 / 12,
    formulaHint: '× 26 ÷ 12 mo',
  },
  monthly: {
    label: 'Monthly',
    shortLabel: '/ mo',
    monthlyMultiplier: 1,
    formulaHint: 'Direct monthly',
  },
  semester: {
    label: 'Per Semester (4 mo)',
    shortLabel: '/ sem',
    monthlyMultiplier: 1 / 4,
    formulaHint: '÷ 4 months',
  },
  annual: {
    label: 'Annual',
    shortLabel: '/ yr',
    monthlyMultiplier: 1 / 12,
    formulaHint: '÷ 12 months',
  },
  onetime: {
    label: 'One-time (This Month)',
    shortLabel: 'once',
    monthlyMultiplier: 1,
    formulaHint: 'Current month only',
  },
};

export const INCOME_SOURCE_LABELS: Record<IncomeSourceType, string> = {
  'part-time-job': 'Part-Time Job',
  'parental-support': 'Parental Support',
  scholarship: 'Scholarship / Grant',
  freelance: 'Freelance / Tutoring',
  'financial-aid': 'Financial Aid',
  other: 'Other Income',
};

export const CATEGORY_COLOR_SWATCHES = [
  { name: 'Ocean Blue', hex: '#0369A1' },
  { name: 'Sky Blue', hex: '#0EA5E9' },
  { name: 'Seafoam Teal', hex: '#14B8A6' },
  { name: 'Periwinkle', hex: '#6366F1' },
  { name: 'Arctic Cyan', hex: '#06B6D4' },
  { name: 'Royal Cobalt', hex: '#2563EB' },
  { name: 'Warm Amber', hex: '#D97706' },
  { name: 'Coral Rose', hex: '#E11D48' },
];

export const DEFAULT_CATEGORIES: BudgetCategory[] = [
  {
    id: 'utilities',
    name: 'Utilities',
    color: '#0369A1',
    monthlyTarget: 160,
    isDefault: true,
    description: 'Electricity, Wi-Fi, water, and mobile phone plan',
  },
  {
    id: 'food',
    name: 'Food',
    color: '#0EA5E9',
    monthlyTarget: 360,
    isDefault: true,
    description: 'Groceries, dining hall meals, and daily coffee',
  },
  {
    id: 'study-materials',
    name: 'Study Materials',
    color: '#14B8A6',
    monthlyTarget: 140,
    isDefault: true,
    description: 'Textbooks, lab fees, notebooks, and academic software',
  },
  {
    id: 'gaming',
    name: 'Gaming',
    color: '#6366F1',
    monthlyTarget: 85,
    isDefault: true,
    description: 'Subscriptions, new releases, and console or PC upgrades',
  },
];

export function toMonthlyAmount(amount: number, frequency: Frequency): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return amount * FREQUENCY_META[frequency].monthlyMultiplier;
}

export function formatCurrency(value: number, showSign = false): string {
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);

  if (value < 0) return `-${formatted}`;
  if (showSign && value > 0) return `+${formatted}`;
  return formatted;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0.0%';
  return `${value.toFixed(1)}%`;
}

export function createInitialBudgetStore(): BudgetStore {
  const today = new Date().toISOString().slice(0, 10);
  return {
    version: 1,
    currency: 'USD',
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    incomes: [
      {
        id: 'inc-campus-job',
        title: 'Campus Library Assistant',
        sourceType: 'part-time-job',
        amount: 340,
        frequency: 'biweekly',
        active: true,
        note: '14 hrs/week after-tax estimate',
      },
      {
        id: 'inc-parental',
        title: 'Monthly Family Support',
        sourceType: 'parental-support',
        amount: 450,
        frequency: 'monthly',
        active: true,
        note: 'Transferred on the 1st of each month',
      },
      {
        id: 'inc-tutoring',
        title: 'Calculus Peer Tutoring',
        sourceType: 'freelance',
        amount: 45,
        frequency: 'weekly',
        active: true,
        note: '3 hours weekly at study center',
      },
    ],
    expenses: [
      {
        id: 'exp-wifi',
        title: 'Apartment Wi-Fi & Electricity Split',
        categoryId: 'utilities',
        amount: 98,
        frequency: 'monthly',
        date: today,
        note: 'Shared evenly with roommate',
      },
      {
        id: 'exp-mobile',
        title: 'Student Mobile Plan',
        categoryId: 'utilities',
        amount: 35,
        frequency: 'monthly',
        date: today,
      },
      {
        id: 'exp-groceries',
        title: 'Weekly Grocery Run',
        categoryId: 'food',
        amount: 68,
        frequency: 'weekly',
        date: today,
        note: 'Groceries and weekly meal prep',
      },
      {
        id: 'exp-coffee',
        title: 'Campus Cafe & Snacks',
        categoryId: 'food',
        amount: 52,
        frequency: 'monthly',
        date: today,
      },
      {
        id: 'exp-textbooks',
        title: 'Semester Textbooks & Lab Pack',
        categoryId: 'study-materials',
        amount: 320,
        frequency: 'semester',
        date: today,
        note: 'Spread across 4-month semester',
      },
      {
        id: 'exp-software',
        title: 'Cloud Notes & Diagramming Suite',
        categoryId: 'study-materials',
        amount: 16,
        frequency: 'monthly',
        date: today,
      },
      {
        id: 'exp-gamepass',
        title: 'Online Pass & Monthly Game Budget',
        categoryId: 'gaming',
        amount: 64,
        frequency: 'monthly',
        date: today,
        note: 'Game subscription and indie titles',
      },
    ],
    savingsGoals: [
      {
        id: 'goal-laptop',
        name: 'New Laptop',
        targetAmount: 1400,
        savedAmount: 780,
        monthlyAllocation: 160,
        color: '#0284C7',
        targetDate: '2027-04-01',
        note: 'Lightweight ultrabook for coursework and projects',
      },
      {
        id: 'goal-vacation',
        name: 'Spring Break Trip',
        targetAmount: 650,
        savedAmount: 290,
        monthlyAllocation: 90,
        color: '#06B6D4',
        targetDate: '2027-03-15',
        note: 'Flights, hostel stay, and rail pass with friends',
      },
      {
        id: 'goal-emergency',
        name: 'Emergency Buffer',
        targetAmount: 1000,
        savedAmount: 420,
        monthlyAllocation: 75,
        color: '#14B8A6',
        note: 'Unexpected repairs or medical copays',
      },
    ],
  };
}

export function createEmptyBudgetStore(): BudgetStore {
  return {
    version: 1,
    currency: 'USD',
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    incomes: [],
    expenses: [],
    savingsGoals: [],
  };
}
