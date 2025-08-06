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
            <div>
                <p class="description">${description}</p>
                <p class="details">${details}</p>
            </div>
            <div class="flex items-center gap-2">
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

export function renderUI() {
    if (!state.store.currentBudget) return;
    dom.loadingSpinner.classList.add('hidden');
    dom.mainContent.classList.remove('hidden');
    renderSummary();
    renderCategories();
    populateTransactionFilters();
    renderTransactionList();
    renderHistoryList();
    renderInsights();
}

// --- RENDER FUNCTIONS ---

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
    if(overallProgressBar && overallProgressBar.parentElement) {
        requestAnimationFrame(() => {
            overallProgressBar.style.width = `${Math.min(100, spentPercentage)}%`;
        });
    }
}

function renderCategories() {
    const container = dom.categoryDetailsContainer;
    if (!container) return;
    
    container.innerHTML = '';
    const types = state.store.currentBudget.types || [];
    const categories = state.store.currentBudget.categories || [];
    
    types.forEach(type => {
        const categoriesOfType = categories.filter(c => c.type === type);
        if (categoriesOfType.length === 0) return;
        
        const section = document.createElement('div');
        section.className = 'mb-6';
        
        const title = document.createElement('h3');
        title.className = 'text-xl sm:text-2xl font-bold text-gray-800 mb-4 pl-1 will-animate';
        title.textContent = type;
        section.appendChild(title);
        observer.observe(title);
        
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
        section.appendChild(grid);
        
        categoriesOfType.forEach((category, index) => {
            const cardHTML = createCategoryCardHTML(category);
            const cardFragment = document.createRange().createContextualFragment(cardHTML);
            const cardElement = cardFragment.firstChild;
            cardElement.style.transitionDelay = `${index * 50}ms`;
            grid.appendChild(cardElement);
            observer.observe(cardElement);
        });
        container.appendChild(section);
    });
}

function renderTransactionList() {
    const listEl = dom.transactionList;
    if (!listEl) return;

    const allItems = [
        ...(state.store.currentBudget.transactions || []).map(t => ({ ...t, type: 'expense' })),
        ...(state.store.currentBudget.incomeTransactions || []).map(t => ({ ...t, type: 'income' }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (allItems.length === 0) {
        listEl.innerHTML = '<p class="text-center text-gray-500 py-8">No transactions or income recorded yet.</p>';
        return;
    }

    listEl.innerHTML = allItems.map(item => createTransactionItemHTML(item)).join('');
}

async function renderHistoryList() {
    const historyList = dom.monthlyHistoryList;
    if (!historyList || !state.store.activeBudgetId) return;

    historyList.innerHTML = '<div class="spinner"></div>';
    try {
        const snapshot = await firestore.getArchivedBudgets(state.store.userId, state.store.activeBudgetId);
        if (snapshot.empty) {
            historyList.innerHTML = '<p class="text-gray-500 text-center">No archives found.</p>';
            return;
        }
        historyList.innerHTML = snapshot.docs
            .sort((a, b) => b.id.localeCompare(a.id))
            .map(doc => `
                <div class="bg-white p-3 rounded-lg flex justify-between items-center shadow-sm">
                    <span class="font-semibold">${doc.id}</span>
                    <button data-archive-id="${doc.id}" class="view-archive-btn btn bg-indigo-500 hover:bg-indigo-600 btn-sm py-1 px-3">View</button>
                </div>
            `).join('');
    } catch (error) {
        console.error("Error fetching archives:", error);
        historyList.innerHTML = '<p class="text-red-500 text-center">Could not load history.</p>';
        showNotification("Failed to load budget history.", "danger");
    }
}

// ... other functions ...
