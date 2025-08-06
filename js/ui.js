import * as state from './state.js';
import * as firestore from './firestore.js';
import * as utils from './utils.js';
import { CONSTANTS, defaultCategoryIcon } from './config.js';
import { startRecognition } from './speech.js';

export let dom = {};
const observer = new IntersectionObserver((entries) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }); }, { threshold: 0.1 });

// --- INITIALIZATION ---

export function initializeDOMCache() {
    dom = {
        loadingSpinner: document.getElementById('loadingSpinner'),
        mainContent: document.getElementById('mainContent'),
        userIdDisplay: document.getElementById('userIdDisplay'),
        userIdValue: document.getElementById('userIdValue'),
        voiceFab: document.getElementById('voiceFab'),
        tabs: document.querySelectorAll('.tab-button'),
        tabPanels: document.querySelectorAll('.tab-panel'),
        budgetControlPanel: document.getElementById('budgetControlPanel'),
        budgetSelector: document.getElementById('budgetSelector'),
        mainFab: document.getElementById('mainFab'),
        fabContainer: document.querySelector('.fab-container'),
        transactionList: document.getElementById('transactionList'),
        categoryDetailsContainer: document.getElementById('categoryDetailsContainer'),
        monthlyHistoryList: document.getElementById('monthlyHistoryList'),
    };
}

export function initializeEventListeners() {
    // Tab Navigation
    if (dom.tabs && dom.tabs.length > 0) {
        dom.tabs.forEach(button => {
            button.addEventListener('click', () => {
                const tab = button.dataset.tab;
                dom.tabs.forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll(`.tab-button[data-tab="${tab}"]`).forEach(btn => btn.classList.add('active'));
                dom.tabPanels.forEach(panel => panel.classList.toggle('active', panel.id === `tab-${tab}`));
            });
        });
    }

    // Budget Controls
    if (dom.budgetSelector) dom.budgetSelector.addEventListener('change', handleBudgetSwitch);
    document.getElementById('addBudgetButton')?.addEventListener('click', handleAddNewBudget);
    document.getElementById('deleteBudgetButton')?.addEventListener('click', deleteCurrentBudget);
    
    // FAB Menu
    if (dom.mainFab) dom.mainFab.addEventListener('click', () => dom.fabContainer.classList.toggle('open'));
    document.getElementById('addExpenseFab')?.addEventListener('click', () => { openTransactionModal(); dom.fabContainer.classList.remove('open'); });
    document.getElementById('addIncomeFab')?.addEventListener('click', () => { openIncomeModal(); dom.fabContainer.classList.remove('open'); });
    if (dom.voiceFab) dom.voiceFab.onclick = startRecognition;

    // Dashboard Buttons
    document.getElementById('addCategoryModalButton')?.addEventListener('click', () => openCategoryModal());
    document.getElementById('archiveMonthButton')?.addEventListener('click', handleArchiveMonth);
    document.getElementById('manageTypesButton')?.addEventListener('click', () => openManagementModal({ title: "Manage Category Types", itemsKey: "types", placeholder: "New Type Name", onAdd: async (name) => { if(!state.store.currentBudget.types) state.store.currentBudget.types = []; state.store.currentBudget.types.push(name); await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget); }, onDelete: async (name) => { const cats = state.store.currentBudget.categories || []; const categoriesUsingType = cats.filter(c => c.type === name); const confirmed = await showConfirmModal('Delete Type?', `This will also delete ${categoriesUsingType.length} associated categories and all their transactions.`); if (confirmed) { state.store.currentBudget.types = state.store.currentBudget.types.filter(t => t !== name); const categoryIdsToDelete = categoriesUsingType.map(c => c.id); state.store.currentBudget.categories = cats.filter(c => c.type !== name); state.store.currentBudget.transactions = (state.store.currentBudget.transactions || []).filter(t => !categoryIdsToDelete.includes(t.categoryId)); await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget); } return confirmed; } }));
    document.getElementById('managePaymentsButton')?.addEventListener('click', () => openManagementModal({ title: "Manage Payment Methods", itemsKey: "paymentMethods", placeholder: "New Payment Method", onAdd: async (name) => { if(!state.store.currentBudget.paymentMethods) state.store.currentBudget.paymentMethods = []; state.store.currentBudget.paymentMethods.push(name); await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget); }, onDelete: async (name) => { const confirmed = await showConfirmModal('Delete Payment Method?', `This will not affect existing transactions.`); if (confirmed) { state.store.currentBudget.paymentMethods = state.store.currentBudget.paymentMethods.filter(pm => pm !== name); await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget); } return confirmed; } }));
    document.getElementById('manageSubcategoriesButton')?.addEventListener('click', () => openSubcategoriesModal());
    
    // List Event Delegation
    if (dom.transactionList) dom.transactionList.addEventListener('click', handleTransactionListClick);
    if (dom.monthlyHistoryList) dom.monthlyHistoryList.addEventListener('click', handleHistoryClick);
    if (dom.categoryDetailsContainer) dom.categoryDetailsContainer.addEventListener('click', handleCategoryCardClick);

    // Filter Controls
    document.getElementById('filterCategory')?.addEventListener('change', renderTransactionList);
    document.getElementById('filterPaymentMethod')?.addEventListener('change', renderTransactionList);
    document.getElementById('filterStartDate')?.addEventListener('change', renderTransactionList);
    document.getElementById('filterEndDate')?.addEventListener('change', renderTransactionList);
    document.getElementById('clearFiltersButton')?.addEventListener('click', () => { document.getElementById('filterCategory').value = 'all'; document.getElementById('filterPaymentMethod').value = 'all'; document.getElementById('filterStartDate').value = ''; document.getElementById('filterEndDate').value = ''; renderTransactionList(); });
}


// --- UI STATE MANAGEMENT ---

export function setUIState(uiState, options = {}) {
    if (dom.loadingSpinner) {
        dom.loadingSpinner.classList.toggle('hidden', uiState !== 'loading');
    }
    if (dom.mainContent) {
        dom.mainContent.classList.toggle('hidden', uiState !== 'loaded');
        if (uiState === 'error') {
            dom.mainContent.innerHTML = `<div class="text-center p-8"><h2 class="text-xl font-bold text-red-600">An Error Occurred</h2><p class="text-gray-600 mt-2">${options.message}</p></div>`;
        }
    }
}

// --- RENDER FUNCTIONS ---

export function renderUI() {
    if (!state.store.currentBudget) return;
    renderSummary();
    renderCategories();
    populateTransactionFilters();
    renderTransactionList();
    renderHistoryList();
    renderInsights();
}

// All other functions are defined below...
// (This space intentionally left blank for clarity before the large block of functions)
