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
    dom.tabs.forEach(button => button.addEventListener('click', () => { const tab = button.dataset.tab; dom.tabs.forEach(btn => btn.classList.remove('active')); document.querySelectorAll(`.tab-button[data-tab="${tab}"]`).forEach(btn => btn.classList.add('active')); dom.tabPanels.forEach(panel => panel.classList.toggle('active', panel.id === `tab-${tab}`)); }));
    dom.budgetSelector.addEventListener('change', handleBudgetSwitch);
    dom.mainFab.addEventListener('click', () => dom.fabContainer.classList.toggle('open'));
    document.getElementById('addBudgetButton').addEventListener('click', handleAddNewBudget);
    document.getElementById('deleteBudgetButton').addEventListener('click', deleteCurrentBudget);
    document.getElementById('addExpenseFab').onclick = () => { openTransactionModal(); dom.fabContainer.classList.remove('open'); };
    document.getElementById('addIncomeFab').onclick = () => { openIncomeModal(); dom.fabContainer.classList.remove('open'); };
    document.getElementById('addCategoryModalButton').onclick = () => openCategoryModal();
    document.getElementById('archiveMonthButton').onclick = handleArchiveMonth;
    dom.voiceFab.onclick = startRecognition;
    document.getElementById('manageTypesButton').onclick = () => openManagementModal({ title: "Manage Category Types", itemsKey: "types", placeholder: "New Type Name", onAdd: async (name) => { if(!state.store.currentBudget.types) state.store.currentBudget.types = []; state.store.currentBudget.types.push(name); await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget); }, onDelete: async (name) => { const categoriesUsingType = state.store.currentBudget.categories.filter(c => c.type === name); const confirmed = await showConfirmModal('Delete Type?', `This will also delete ${categoriesUsingType.length} associated categories and all their transactions.`); if (confirmed) { state.store.currentBudget.types = state.store.currentBudget.types.filter(t => t !== name); const categoryIdsToDelete = categoriesUsingType.map(c => c.id); state.store.currentBudget.categories = state.store.currentBudget.categories.filter(c => c.type !== name); state.store.currentBudget.transactions = state.store.currentBudget.transactions.filter(t => !categoryIdsToDelete.includes(t.categoryId)); await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget); } return confirmed; } });
    document.getElementById('managePaymentsButton').onclick = () => openManagementModal({ title: "Manage Payment Methods", itemsKey: "paymentMethods", placeholder: "New Payment Method", onAdd: async (name) => { if(!state.store.currentBudget.paymentMethods) state.store.currentBudget.paymentMethods = []; state.store.currentBudget.paymentMethods.push(name); await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget); }, onDelete: async (name) => { const confirmed = await showConfirmModal('Delete Payment Method?', `This will not affect existing transactions.`); if (confirmed) { state.store.currentBudget.paymentMethods = state.store.currentBudget.paymentMethods.filter(pm => pm !== name); await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget); } return confirmed; } });
    document.getElementById('manageSubcategoriesButton').onclick = () => openSubcategoriesModal();
    dom.transactionList.addEventListener('click', handleTransactionListClick);
    dom.monthlyHistoryList.addEventListener('click', handleHistoryClick);
    document.getElementById('filterCategory').addEventListener('change', renderTransactionList);
    document.getElementById('filterPaymentMethod').addEventListener('change', renderTransactionList);
    document.getElementById('filterStartDate').addEventListener('change', renderTransactionList);
    document.getElementById('filterEndDate').addEventListener('change', renderTransactionList);
    document.getElementById('clearFiltersButton').onclick = () => { document.getElementById('filterCategory').value = 'all'; document.getElementById('filterPaymentMethod').value = 'all'; document.getElementById('filterStartDate').value = ''; document.getElementById('filterEndDate').value = ''; renderTransactionList(); };
}

// --- UI STATE MANAGEMENT ---

export function setUIState(uiState, options = {}) {
    if (dom.loadingSpinner) {
        dom.loadingSpinner.classList.toggle('hidden', uiState !== 'loading');
    }
    if (dom.mainContent) {
        dom.mainContent.classList.toggle('hidden', uiState !== 'loaded');
    }
    if (uiState === 'error') {
        if (dom.mainContent) {
            dom.mainContent.innerHTML = `<div class="text-center p-8"><h2 class="text-xl font-bold text-red-600">An Error Occurred</h2><p class="text-gray-600 mt-2">${options.message}</p></div>`;
            dom.mainContent.classList.remove('hidden');
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

function renderSummary() {
    const totalIncome = state.store.calculateTotalIncome();
    const totalSpent = (state.store.currentBudget.categories || []).reduce((sum, cat) => sum + (cat.spent || 0), 0);
    const netFlow = totalIncome - totalSpent;
    const spentPercentage = totalIncome > 0 ? (totalSpent / totalIncome) * 100 : 0;
    
    document.getElementById('totalBudgetValue').textContent = totalIncome.toFixed(2);
    document.getElementById('totalSpentValue').textContent = totalSpent.toFixed(2);
    
    const remainingEl = document.getElementById('overallRemainingValue');
    remainingEl.textContent = netFlow.toFixed(2);
    remainingEl.className = `font-bold ${netFlow < 0 ? 'text-red-600' : 'text-green-600'}`;
    
    const overallProgressBar = document.getElementById('overallProgressBar');
    if (overallProgressBar) {
        requestAnimationFrame(() => {
            overallProgressBar.style.width = `${Math.min(100, spentPercentage)}%`;
        });
    }
}

function renderCategories() { /* ... full function from previous correct version ... */ }
function createCategoryCard(category) { /* ... full function from previous correct version ... */ }
function renderTransactionList() { /* ... full function from previous correct version ... */ }
function renderHistoryList() { /* ... full function from previous correct version ... */ }
function renderInsights() { /* ... full function from previous correct version ... */ }
function renderNeedsWantsChart() { /* ... full function from previous correct version ... */ }
function renderBudgetHotspots() { /* ... full function from previous correct version ... */ }
async function renderHistoricalCharts() { /* ... full function from previous correct version ... */ }
function populateTransactionFilters() { /* ... full function from previous correct version ... */ }
export function populateBudgetSelector() { /* ... full function from previous correct version ... */ }

// --- EVENT HANDLERS & MODAL LOGIC ---

async function handleBudgetSwitch() { /* ... full function from previous correct version ... */ }
async function handleAddNewBudget() { /* ... full function from previous correct version ... */ }
async function deleteCurrentBudget() { /* ... full function from previous correct version ... */ }
async function handleArchiveMonth() { /* ... full function from previous correct version ... */ }
function handleTransactionListClick(e) { /* ... full function from previous correct version ... */ }
async function handleHistoryClick(e) { /* ... full function from previous correct version ... */ }
function openTransactionModal(transaction = null) { /* ... full function ... */ }
async function handleTransactionFormSubmit(e) { /* ... full function ... */ }
async function handleDeleteTransaction(transactionId) { /* ... full function ... */ }
function openIncomeModal(income = null) { /* ... full function ... */ }
async function handleIncomeFormSubmit(e) { /* ... full function ... */ }
async function handleDeleteIncome(incomeId) { /* ... full function ... */ }
function openCategoryModal(category = null) { /* ... full function ... */ }
async function handleCategoryFormSubmit(e) { /* ... full function ... */ }
async function handleDeleteCategory(categoryId) { /* ... full function from previous correct version ... */ }
function openManagementModal({ title, itemsKey, placeholder, onAdd, onDelete }) { /* ... full function ... */ }
function openSubcategoriesModal() { /* ... full function ... */ }


// --- UI UTILITIES ---
export function showNotification(message, type = 'info', duration = 3000) { /* ... */ }
export function showModal(id) { /* ... */ }
export function hideModal(id) { /* ... */ }
export async function showConfirmModal(title, message) { /* ... */ }
