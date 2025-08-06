// This file is the single source of truth for the application's state.
// It holds all the data and is the only place where state can be modified.

// The internal, private state of the application.
const state = {
    currentBudget: null,
    userId: null,
    isAuthReady: false,
    unsubscribeBudget: null,
    editingCategoryId: null,
    editingTransactionId: null,
    editingIncomeId: null,
    lastAddedItemId: null,
    transactionPieChart: null,
    needsWantsChart: null,
    historicalSavingsChart: null,
    categoryDeepDiveChart: null,
    activeBudgetId: null,
    allBudgets: {},
};

// The single listener function (our subscriber). It will be set to ui.js's renderUI function.
let listener = () => {};

// This function notifies the subscriber that the state has changed.
function publish() {
    listener();
}

// --- Public Store Object ---
// This is the exported "API" for interacting with the state.
export const store = {
    // Allows the main.js file to connect the UI's render function to state changes.
    subscribe: (callback) => {
        listener = callback;
    },

    // --- GETTERS: Read-only access to the state ---
    get currentBudget() { return state.currentBudget; },
    get userId() { return state.userId; },
    get isAuthReady() { return state.isAuthReady; },
    get editingCategoryId() { return state.editingCategoryId; },
    get editingTransactionId() { return state.editingTransactionId; },
    get editingIncomeId() { return state.editingIncomeId; },
    get lastAddedItemId() { return state.lastAddedItemId; },
    get activeBudgetId() { return state.activeBudgetId; },
    get allBudgets() { return state.allBudgets; },
    get transactionPieChart() { return state.transactionPieChart; },
    get needsWantsChart() { return state.needsWantsChart; },
    get historicalSavingsChart() { return state.historicalSavingsChart; },
    get categoryDeepDiveChart() { return state.categoryDeepDiveChart; },

    // --- SETTERS: The only way to modify the state ---
    setCurrentBudget: (budget) => { state.currentBudget = budget; publish(); },
    setUserId: (uid) => { state.userId = uid; state.isAuthReady = true; document.getElementById('userIdValue').textContent = uid; document.getElementById('userIdDisplay').classList.remove('hidden'); },
    setUnsubscribe: (fn) => { if (state.unsubscribeBudget) { state.unsubscribeBudget(); } state.unsubscribeBudget = fn; },
    setEditingCategoryId: (id) => { state.editingCategoryId = id; },
    setEditingTransactionId: (id) => { state.editingTransactionId = id; },
    setEditingIncomeId: (id) => { state.editingIncomeId = id; },
    setLastAddedItemId: (id) => { state.lastAddedItemId = id; },
    setActiveBudgetId: (id) => { state.activeBudgetId = id; },
    setAllBudgets: (budgets) => { state.allBudgets = budgets; },
    updateAllBudgets: (id, name) => { state.allBudgets[id] = name; },
    deleteFromAllBudgets: (id) => { delete state.allBudgets[id]; },

    setTransactionPieChart: (chart) => { if (state.transactionPieChart) state.transactionPieChart.destroy(); state.transactionPieChart = chart; },
    setNeedsWantsChart: (chart) => { if (state.needsWantsChart) state.needsWantsChart.destroy(); state.needsWantsChart = chart; },
    setHistoricalSavingsChart: (chart) => { if (state.historicalSavingsChart) state.historicalSavingsChart.destroy(); state.historicalSavingsChart = chart; },
    setCategoryDeepDiveChart: (chart) => { if (state.categoryDeepDiveChart) state.categoryDeepDiveChart.destroy(); state.categoryDeepDiveChart = chart; },

    // --- STATE-BASED HELPER FUNCTIONS ---
    calculateTotalIncome: () => (state.currentBudget?.incomeTransactions || []).reduce((sum, t) => sum + (t.amount || 0), 0),
    recalculateSpentAmounts: () => {
        if (!state.currentBudget?.categories) return;
        state.currentBudget.categories.forEach(cat => cat.spent = 0);
        (state.currentBudget.transactions || []).forEach(trans => {
            const category = state.currentBudget.categories.find(cat => cat.id === trans.categoryId);
            if (category) category.spent += trans.amount;
        });
    }
};

// Also export individual setters for convenience where a full re-render isn't needed immediately.
export const { setUserId, setEditingCategoryId, setEditingTransactionId, setEditingIncomeId, setLastAddedItemId, setActiveBudgetId } = store;
