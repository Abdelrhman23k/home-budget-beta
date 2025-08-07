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

let listener = () => {};

function publish() {
    if (typeof listener === 'function') {
        listener();
    }
}

export const store = {
    subscribe: (callback) => {
        listener = callback;
    },

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

    setCurrentBudget: (budget) => { state.currentBudget = budget; publish(); },
    setUnsubscribe: (fn) => { if (state.unsubscribeBudget) { state.unsubscribeBudget(); } state.unsubscribeBudget = fn; },
    setAllBudgets: (budgets) => { state.allBudgets = budgets; },
    updateAllBudgets: (id, name) => { state.allBudgets[id] = name; },
    deleteFromAllBudgets: (id) => { delete state.allBudgets[id]; },
    
    setTransactionPieChart: (chart) => { if (state.transactionPieChart) state.transactionPieChart.destroy(); state.transactionPieChart = chart; },
    setNeedsWantsChart: (chart) => { if (state.needsWantsChart) state.needsWantsChart.destroy(); state.needsWantsChart = chart; },
    setHistoricalSavingsChart: (chart) => { if (state.historicalSavingsChart) state.historicalSavingsChart.destroy(); state.historicalSavingsChart = chart; },
    setCategoryDeepDiveChart: (chart) => { if (state.categoryDeepDiveChart) state.categoryDeepDiveChart.destroy(); state.categoryDeepDiveChart = chart; },

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

export const setUserId = (uid) => { state.userId = uid; state.isAuthReady = true; };
export const setEditingCategoryId = (id) => { state.editingCategoryId = id; };
export const setEditingTransactionId = (id) => { state.editingTransactionId = id; };
export const setEditingIncomeId = (id) => { state.editingIncomeId = id; };
export const setLastAddedItemId = (id) => { state.lastAddedItemId = id; };
export const setActiveBudgetId = (id) => { state.activeBudgetId = id; };
