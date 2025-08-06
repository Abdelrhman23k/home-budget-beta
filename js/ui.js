import * as state from './state.js';
import * as firestore from './firestore.js';
import * as utils from './utils.js';
import { CONSTANTS, defaultCategoryIcon } from './config.js';

export let dom = {};

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
    dom.tabs.forEach(button => button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        dom.tabs.forEach(btn => btn.classList.remove('active'));
        // Re-query within the nav bar and top bar to handle both layouts
        document.querySelectorAll(`.tab-button[data-tab="${tab}"]`).forEach(btn => btn.classList.add('active'));
        dom.tabPanels.forEach(panel => panel.classList.toggle('active', panel.id === `tab-${tab}`));
    }));

    dom.budgetSelector.addEventListener('change', handleBudgetSwitch);
    dom.mainFab.addEventListener('click', () => dom.fabContainer.classList.toggle('open'));

    document.getElementById('addBudgetButton').addEventListener('click', async () => {
        const name = prompt("Enter a name for the new budget:", "New Budget");
        if (name) {
            const newBudget = await firestore.createNewBudget(state.userId, name);
            if (newBudget) {
                state.updateAllBudgets(newBudget.id, newBudget.name);
                populateBudgetSelector();
                dom.budgetSelector.value = newBudget.id;
                await handleBudgetSwitch();
            }
        }
    });

    document.getElementById('deleteBudgetButton').addEventListener('click', deleteCurrentBudget);
    document.getElementById('addExpenseFab').onclick = () => { openTransactionModal(); dom.fabContainer.classList.remove('open'); };
    document.getElementById('addIncomeFab').onclick = () => { openIncomeModal(); dom.fabContainer.classList.remove('open'); };
    document.getElementById('addCategoryModalButton').onclick = () => openCategoryModal();
    document.getElementById('archiveMonthButton').onclick = handleArchiveMonth;
    document.getElementById('manageTypesButton').onclick = () => openManagementModal({ title: "Manage Category Types", itemsKey: "types", placeholder: "New Type Name", onAdd: async (name) => { if(!state.currentBudget.types) state.currentBudget.types = []; state.currentBudget.types.push(name); await firestore.saveBudget(state.userId, state.activeBudgetId, state.currentBudget); }, onDelete: async (name) => { const categoriesUsingType = state.currentBudget.categories.filter(c => c.type === name); const confirmed = await showConfirmModal('Delete Type?', `This will also delete ${categoriesUsingType.length} associated categories and all their transactions.`); if (confirmed) { state.currentBudget.types = state.currentBudget.types.filter(t => t !== name); const categoryIdsToDelete = categoriesUsingType.map(c => c.id); state.currentBudget.categories = state.currentBudget.categories.filter(c => c.type !== name); state.currentBudget.transactions = state.currentBudget.transactions.filter(t => !categoryIdsToDelete.includes(t.categoryId)); await firestore.saveBudget(state.userId, state.activeBudgetId, state.currentBudget); } return confirmed; } });
    document.getElementById('managePaymentsButton').onclick = () => openManagementModal({ title: "Manage Payment Methods", itemsKey: "paymentMethods", placeholder: "New Payment Method", onAdd: async (name) => { if(!state.currentBudget.paymentMethods) state.currentBudget.paymentMethods = []; state.currentBudget.paymentMethods.push(name); await firestore.saveBudget(state.userId, state.activeBudgetId, state.currentBudget); }, onDelete: async (name) => { const confirmed = await showConfirmModal('Delete Payment Method?', `This will not affect existing transactions.`); if (confirmed) { state.currentBudget.paymentMethods = state.currentBudget.paymentMethods.filter(pm => pm !== name); await firestore.saveBudget(state.userId, state.activeBudgetId, state.currentBudget); } return confirmed; } });
    document.getElementById('manageSubcategoriesButton').onclick = () => openSubcategoriesModal();
    
    // Transaction List Listener for Edit/Delete
    dom.transactionList.addEventListener('click', (e) => {
        const itemElement = e.target.closest('.transaction-item');
        if (!itemElement) return;
        
        const id = itemElement.dataset.id;
        const type = itemElement.dataset.type;

        if (e.target.closest('.edit-btn')) {
            if (type === 'income') {
                const income = (state.currentBudget.incomeTransactions || []).find(i => i.id === id);
                if(income) openIncomeModal(income);
            } else {
                const transaction = (state.currentBudget.transactions || []).find(t => t.id === id);
                if(transaction) openTransactionModal(transaction);
            }
        } else if (e.target.closest('.delete-btn')) {
            if (type === 'income') {
                handleDeleteIncome(id);
            } else {
                handleDeleteTransaction(id);
            }
        }
    });

    // Other listeners
    document.getElementById('filterCategory').addEventListener('change', renderTransactionList);
    document.getElementById('filterPaymentMethod').addEventListener('change', renderTransactionList);
    document.getElementById('filterStartDate').addEventListener('change', renderTransactionList);
    document.getElementById('filterEndDate').addEventListener('change', renderTransactionList);
    document.getElementById('clearFiltersButton').onclick = () => { document.getElementById('filterCategory').value = 'all'; document.getElementById('filterPaymentMethod').value = 'all'; document.getElementById('filterStartDate').value = ''; document.getElementById('filterEndDate').value = ''; renderTransactionList(); };
    dom.monthlyHistoryList.addEventListener('click', handleHistoryClick);
}

// --- RENDER FUNCTIONS ---

export function renderUI() {
    if (!state.currentBudget) return;
    dom.loadingSpinner.classList.add('hidden');
    dom.mainContent.classList.remove('hidden');
    renderSummary();
    renderCategories();
    populateTransactionFilters();
    renderTransactionList();
    renderHistoryList();
    renderInsights();
}

function renderSummary() { /* ... full function ... */ }
function renderCategories() { /* ... full function ... */ }
function createCategoryCard(category) { /* ... full function ... */ }
function renderTransactionList() { /* ... full function ... */ }
function renderHistoryList() { /* ... full function ... */ }
function renderInsights() { /* ... full function ... */ }
// ... all other render* and chart functions

// --- EVENT HANDLERS & MODAL LOGIC ---

function handleBudgetSwitch() { /* ... full function ... */ }
async function deleteCurrentBudget() { /* ... full function ... */ }
async function handleArchiveMonth() { /* ... full function ... */ }
function openTransactionModal(transaction = null) { /* ... full function ... */ }
async function handleTransactionFormSubmit(e) { /* ... full function ... */ }
async function handleDeleteTransaction(transactionId) { /* ... full function ... */ }
function openIncomeModal(income = null) { /* ... full function ... */ }
async function handleIncomeFormSubmit(e) { /* ... full function ... */ }
async function handleDeleteIncome(incomeId) { /* ... full function ... */ }
// ... all other modal, handler, and populate functions

// --- UI UTILITIES ---
export function showNotification(message, type = 'info', duration = 3000) { /* ... */ }
export function showModal(id) { /* ... */ }
export function hideModal(id) { /* ... */ }
export async function showConfirmModal(title, message) { /* ... */ }
