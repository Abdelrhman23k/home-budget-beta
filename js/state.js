// This file holds the live state of the application.
// Other modules will import from here to get or set the current state.

export let currentBudget = null;
export let userId = null;
export let isAuthReady = false;
export let unsubscribeBudget = null;
export let editingCategoryId = null;
export let editingTransactionId = null;
export let editingIncomeId = null;
export let lastAddedItemId = null;

// Chart instances
export let transactionPieChart = null;
export let needsWantsChart = null;
export let historicalSavingsChart = null;
export let categoryDeepDiveChart = null;

// Multi-Budget State
export let activeBudgetId = null;
export let allBudgets = {};

// --- State Setters ---
export function setCurrentBudget(budget) { currentBudget = budget; }
export function setUserId(uid) { userId = uid; isAuthReady = true; }
export function setUnsubscribe(fn) { if (unsubscribeBudget) { unsubscribeBudget(); } unsubscribeBudget = fn; }
export function setEditingCategoryId(id) { editingCategoryId = id; }
export function setEditingTransactionId(id) { editingTransactionId = id; }
export function setEditingIncomeId(id) { editingIncomeId = id; }
export function setLastAddedItemId(id) { lastAddedItemId = id; }
export function setActiveBudgetId(id) { activeBudgetId = id; }
export function setAllBudgets(budgets) { allBudgets = budgets; }
export function updateAllBudgets(id, name) { allBudgets[id] = name; }
export function deleteFromAllBudgets(id) { delete allBudgets[id]; }

export function setTransactionPieChart(chart) { if (transactionPieChart) transactionPieChart.destroy(); transactionPieChart = chart; }
export function setNeedsWantsChart(chart) { if (needsWantsChart) needsWantsChart.destroy(); needsWantsChart = chart; }
export function setHistoricalSavingsChart(chart) { if (historicalSavingsChart) historicalSavingsChart.destroy(); historicalSavingsChart = chart; }
export function setCategoryDeepDiveChart(chart) { if (categoryDeepDiveChart) categoryDeepDiveChart.destroy(); categoryDeepDiveChart = chart; }


// --- State-based Helper Functions ---
export function calculateTotalIncome() {
    return (currentBudget?.incomeTransactions || []).reduce((sum, t) => sum + (t.amount || 0), 0);
}

export function recalculateSpentAmounts() {
    if (!currentBudget?.categories) return;
    currentBudget.categories.forEach(cat => cat.spent = 0);
    (currentBudget.transactions || []).forEach(trans => {
        const category = currentBudget.categories.find(cat => cat.id === trans.categoryId);
        if (category) {
            category.spent += trans.amount;
        }
    });
}
