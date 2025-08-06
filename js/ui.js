import * as state from './state.js';
import * as firestore from './firestore.js';
import * as utils from './utils.js';
import { CONSTANTS, defaultCategoryIcon } from './config.js';
import { startRecognition } from './speech.js';

export let dom = {};
const observer = new IntersectionObserver((entries) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }); }, { threshold: 0.1 });

// --- HTML COMPONENT GENERATORS ---

function createCategoryCardHTML(category) {
    const spent = category.spent || 0;
    const allocated = category.allocated || 0;
    const remaining = allocated - spent;
    const percentage = allocated > 0 ? (spent / allocated) * 100 : 0;

    return `
        <div class="category-card" data-category-id="${category.id}" style="border-color: ${category.color || '#cccccc'};">
            <div class="flex justify-between items-start w-full">
                <div class="flex items-center gap-2">
                    ${category.icon || defaultCategoryIcon}
                    <h4 class="font-bold text-base sm:text-lg text-gray-900">${category.name}</h4>
                </div>
                <div class="flex gap-2">
                    <button data-action="edit-category" class="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                        <svg class="pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </button>
                    <button data-action="delete-category" class="p-1 text-gray-400 hover:text-red-600 transition-colors">
                        <svg class="pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
            <div class="w-full">
                <p class="text-sm text-gray-500">
                    <span class="font-semibold text-gray-700">${spent.toFixed(2)}</span> / ${allocated.toFixed(2)} EGP
                </p>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${Math.min(100, percentage)}%; background-color: ${category.color || '#cccccc'};"></div>
                </div>
                <p class="text-right text-xs sm:text-sm mt-1 font-medium ${remaining < 0 ? 'text-red-500' : 'text-gray-600'}">
                    ${remaining.toFixed(2)} EGP remaining
                </p>
            </div>
        </div>
    `;
}

function createTransactionItemHTML(item) {
    let description, details, amount, buttons, typeClass, flashClass;

    const editButtonSVG = `<svg class="pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;
    const deleteButtonSVG = `<svg class="pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

    if (item.type === 'income') {
        description = item.description || 'Income';
        details = utils.formatTimestamp(item.date);
        amount = `+${(item.amount || 0).toFixed(2)} EGP`;
        typeClass = 'income';
        flashClass = 'flash-enter-income';
        buttons = `<button data-action="edit-income" class="p-1 text-gray-400 hover:text-blue-600">${editButtonSVG}</button><button data-action="delete-income" class="p-1 text-gray-400 hover:text-red-600">${deleteButtonSVG}</button>`;
    } else {
        const category = state.store.currentBudget.categories.find(c => c.id === item.categoryId);
        description = item.description || category?.name || 'Expense';
        details = `${category?.name || 'Uncategorized'}・${utils.formatTimestamp(item.date)}`;
        amount = `-${(item.amount || 0).toFixed(2)} EGP`;
        typeClass = 'expense';
        flashClass = 'flash-enter-expense';
        buttons = `<button data-action="edit-expense" class="p-1 text-gray-400 hover:text-blue-600">${editButtonSVG}</button><button data-action="delete-expense" class="p-1 text-gray-400 hover:text-red-600">${deleteButtonSVG}</button>`;
    }

    const isNew = item.id === state.store.lastAddedItemId;
    
    return `
        <div class="transaction-item ${typeClass} ${isNew ? flashClass : ''}" data-id="${item.id}" data-type="${item.type}">
            <div class="flex-grow pr-4">
                <p class="description">${description}</p>
                <p class="details">${details}</p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <span class="amount">${amount}</span>
                ${buttons}
            </div>
        </div>
    `;
}

// --- CORE UI FUNCTIONS ---

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
        document.querySelectorAll(`.tab-button[data-tab="${tab}"]`).forEach(btn => btn.classList.add('active'));
        dom.tabPanels.forEach(panel => panel.classList.toggle('active', panel.id === `tab-${tab}`));
    }));

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

// ... Rest of the file
