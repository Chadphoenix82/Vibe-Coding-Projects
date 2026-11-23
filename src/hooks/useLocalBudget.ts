import { useState, useEffect, useCallback } from 'react';
import {
  BudgetCategory,
  BudgetStore,
  ExpenseItem,
  IncomeItem,
  SavingsGoal,
  createEmptyBudgetStore,
  createInitialBudgetStore,
  DEFAULT_CATEGORIES,
} from '../types/budget';

const STORAGE_KEY = 'clearterm_student_budget_v1';

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function loadFromLocalStorage(): BudgetStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialBudgetStore();
    }
    const parsed = JSON.parse(raw) as Partial<BudgetStore>;
    if (
      !parsed ||
      !Array.isArray(parsed.categories) ||
      !Array.isArray(parsed.expenses) ||
      !Array.isArray(parsed.incomes)
    ) {
      return createInitialBudgetStore();
    }
    const categories =
      parsed.categories.length > 0 ? parsed.categories : DEFAULT_CATEGORIES.map((c) => ({ ...c }));
    return {
      version: 1,
      currency: parsed.currency || 'USD',
      categories,
      expenses: parsed.expenses,
      incomes: parsed.incomes,
      savingsGoals: Array.isArray(parsed.savingsGoals) ? parsed.savingsGoals : [],
    };
  } catch {
    return createInitialBudgetStore();
  }
}

export function useLocalBudget() {
  const [store, setStore] = useState<BudgetStore>(() => loadFromLocalStorage());
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      setStorageError(null);
    } catch {
      setStorageError('Browser storage is full or disabled. Changes remain active for this session.');
    }
  }, [store]);

  const addExpense = useCallback((expense: Omit<ExpenseItem, 'id'>) => {
    const newItem: ExpenseItem = { ...expense, id: generateId('exp') };
    setStore((prev) => ({
      ...prev,
      expenses: [newItem, ...prev.expenses],
    }));
    return newItem;
  }, []);

  const updateExpense = useCallback((id: string, updates: Partial<Omit<ExpenseItem, 'id'>>) => {
    setStore((prev) => ({
      ...prev,
      expenses: prev.expenses.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    }));
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setStore((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((item) => item.id !== id),
    }));
  }, []);

  const addIncome = useCallback((income: Omit<IncomeItem, 'id'>) => {
    const newItem: IncomeItem = { ...income, id: generateId('inc') };
    setStore((prev) => ({
      ...prev,
      incomes: [newItem, ...prev.incomes],
    }));
    return newItem;
  }, []);

  const updateIncome = useCallback((id: string, updates: Partial<Omit<IncomeItem, 'id'>>) => {
    setStore((prev) => ({
      ...prev,
      incomes: prev.incomes.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    }));
  }, []);

  const toggleIncomeActive = useCallback((id: string) => {
    setStore((prev) => ({
      ...prev,
      incomes: prev.incomes.map((item) => (item.id === id ? { ...item, active: !item.active } : item)),
    }));
  }, []);

  const deleteIncome = useCallback((id: string) => {
    setStore((prev) => ({
      ...prev,
      incomes: prev.incomes.filter((item) => item.id !== id),
    }));
  }, []);

  const addSavingsGoal = useCallback((goal: Omit<SavingsGoal, 'id'>) => {
    const newGoal: SavingsGoal = { ...goal, id: generateId('goal') };
    setStore((prev) => ({
      ...prev,
      savingsGoals: [newGoal, ...prev.savingsGoals],
    }));
    return newGoal;
  }, []);

  const updateSavingsGoal = useCallback((id: string, updates: Partial<Omit<SavingsGoal, 'id'>>) => {
    setStore((prev) => ({
      ...prev,
      savingsGoals: prev.savingsGoals.map((goal) => (goal.id === id ? { ...goal, ...updates } : goal)),
    }));
  }, []);

  const allocateToSavingsGoal = useCallback((id: string, delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) return;
    setStore((prev) => ({
      ...prev,
      savingsGoals: prev.savingsGoals.map((goal) => {
        if (goal.id !== id) return goal;
        const nextSaved = Math.max(0, Number((goal.savedAmount + delta).toFixed(2)));
        return { ...goal, savedAmount: nextSaved };
      }),
    }));
  }, []);

  const deleteSavingsGoal = useCallback((id: string) => {
    setStore((prev) => ({
      ...prev,
      savingsGoals: prev.savingsGoals.filter((goal) => goal.id !== id),
    }));
  }, []);

  const addCategory = useCallback((category: Omit<BudgetCategory, 'id'>) => {
    const slug = category.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const id = `${slug || 'cat'}-${Math.random().toString(36).slice(2, 5)}`;
    const newCat: BudgetCategory = { ...category, id };
    setStore((prev) => ({
      ...prev,
      categories: [...prev.categories, newCat],
    }));
    return newCat;
  }, []);

  const updateCategory = useCallback((id: string, updates: Partial<Omit<BudgetCategory, 'id'>>) => {
    setStore((prev) => ({
      ...prev,
      categories: prev.categories.map((cat) => (cat.id === id ? { ...cat, ...updates } : cat)),
    }));
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setStore((prev) => {
      if (prev.categories.length <= 1) return prev;
      const remaining = prev.categories.filter((cat) => cat.id !== id);
      const fallbackId = remaining[0].id;
      return {
        ...prev,
        categories: remaining,
        expenses: prev.expenses.map((exp) =>
          exp.categoryId === id ? { ...exp, categoryId: fallbackId } : exp
        ),
      };
    });
  }, []);

  const clearAllEntries = useCallback(() => {
    setStore(createEmptyBudgetStore());
  }, []);

  const loadSampleData = useCallback(() => {
    setStore(createInitialBudgetStore());
  }, []);

  const importJsonData = useCallback((rawJson: string): { ok: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(rawJson) as Partial<BudgetStore>;
      if (
        !parsed ||
        !Array.isArray(parsed.categories) ||
        !Array.isArray(parsed.expenses) ||
        !Array.isArray(parsed.incomes)
      ) {
        return { ok: false, error: 'File does not match ClearTerm budget format.' };
      }
      setStore({
        version: 1,
        currency: parsed.currency || 'USD',
        categories:
          parsed.categories.length > 0 ? parsed.categories : DEFAULT_CATEGORIES.map((c) => ({ ...c })),
        expenses: parsed.expenses,
        incomes: parsed.incomes,
        savingsGoals: Array.isArray(parsed.savingsGoals) ? parsed.savingsGoals : [],
      });
      return { ok: true };
    } catch {
      return { ok: false, error: 'Invalid JSON file.' };
    }
  }, []);

  return {
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
  };
}
