import * as state from './state.js';
import * as firestore from './firestore.js';
import * as utils from './utils.js';
import { CONSTANTS, defaultCategoryIcon } from './config.js';
import { startRecognition } from './speech.js';

export let dom = {};
const observer = new IntersectionObserver((entries) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }); }, { threshold: 0.1 });

// --- INITIALIZATION & EVENT LISTENERS ---

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

    if (dom.budgetSelector) dom.budgetSelector.addEventListener('change', handleBudgetSwitch);
    if (dom.mainFab) dom.mainFab.addEventListener('click', () => dom.fabContainer.classList.toggle('open'));
    
    document.getElementById('addBudgetButton')?.addEventListener('click', handleAddNewBudget);
    document.getElementById('deleteBudgetButton')?.addEventListener('click', deleteCurrentBudget);
    document.getElementById('addExpenseFab')?.addEventListener('click', () => { openTransactionModal(); dom.fabContainer.classList.remove('open'); });
    document.getElementById('addIncomeFab')?.addEventListener('click', () => { openIncomeModal(); dom.fabContainer.classList.remove('open'); });
    document.getElementById('addCategoryModalButton')?.addEventListener('click', () => openCategoryModal());
    document.getElementById('archiveMonthButton')?.addEventListener('click', handleArchiveMonth);
    if (dom.voiceFab) dom.voiceFab.onclick = startRecognition;
    
    document.getElementById('manageTypesButton')?.addEventListener('click', () => openManagementModal({ title: "Manage Category Types", itemsKey: "types", placeholder: "New Type Name", onAdd: async (name) => { if(!state.store.currentBudget.types) state.store.currentBudget.types = []; state.store.currentBudget.types.push(name); await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget); }, onDelete: async (name) => { const cats = state.store.currentBudget.categories || []; const categoriesUsingType = cats.filter(c => c.type === name); const confirmed = await showConfirmModal('Delete Type?', `This will also delete ${categoriesUsingType.length} associated categories and all their transactions.`); if (confirmed) { state.store.currentBudget.types = state.store.currentBudget.types.filter(t => t !== name); const categoryIdsToDelete = categoriesUsingType.map(c => c.id); state.store.currentBudget.categories = cats.filter(c => c.type !== name); state.store.currentBudget.transactions = (state.store.currentBudget.transactions || []).filter(t => !categoryIdsToDelete.includes(t.categoryId)); await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget); } return confirmed; } }));
    document.getElementById('managePaymentsButton')?.addEventListener('click', () => openManagementModal({ title: "Manage Payment Methods", itemsKey: "paymentMethods", placeholder: "New Payment Method", onAdd: async (name) => { if(!state.store.currentBudget.paymentMethods) state.store.currentBudget.paymentMethods = []; state.store.currentBudget.paymentMethods.push(name); await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget); }, onDelete: async (name) => { const confirmed = await showConfirmModal('Delete Payment Method?', `This will not affect existing transactions.`); if (confirmed) { state.store.currentBudget.paymentMethods = state.store.currentBudget.paymentMethods.filter(pm => pm !== name); await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget); } return confirmed; } }));
    document.getElementById('manageSubcategoriesButton')?.addEventListener('click', () => openSubcategoriesModal());
    
    if (dom.transactionList) dom.transactionList.addEventListener('click', handleTransactionListClick);
    if (dom.monthlyHistoryList) dom.monthlyHistoryList.addEventListener('click', handleHistoryClick);
    if (dom.categoryDetailsContainer) dom.categoryDetailsContainer.addEventListener('click', handleCategoryCardClick);

    document.getElementById('filterCategory')?.addEventListener('change', renderTransactionList);
    document.getElementById('filterPaymentMethod')?.addEventListener('change', renderTransactionList);
    document.getElementById('filterStartDate')?.addEventListener('change', renderTransactionList);
    document.getElementById('filterEndDate')?.addEventListener('change', renderTransactionList);
    document.getElementById('clearFiltersButton')?.addEventListener('click', () => { 
        const categoryFilter = document.getElementById('filterCategory');
        const paymentFilter = document.getElementById('filterPaymentMethod');
        const startFilter = document.getElementById('filterStartDate');
        const endFilter = document.getElementById('filterEndDate');
        if (categoryFilter) categoryFilter.value = 'all';
        if (paymentFilter) paymentFilter.value = 'all';
        if (startFilter) startFilter.value = '';
        if (endFilter) endFilter.value = '';
        renderTransactionList(); 
    });
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
            if (cardElement) {
                cardElement.style.transitionDelay = `${index * 50}ms`;
                grid.appendChild(cardElement);
                observer.observe(cardElement);
            }
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
    
    if (state.store.lastAddedItemId) {
        state.setLastAddedItemId(null);
    }
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
        historyList.innerHTML = '<p class="text-red-500 text-center">Could not load history.</p>';
    }
}

// --- All other functions ---
// (The rest of the file is included below)

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
    const deleteButtonSVG = `<svg class="pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`;

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

// --- INSIGHTS RENDERING ---

function renderInsights() {
    renderNeedsWantsChart();
    renderBudgetHotspots();
    renderHistoricalCharts();
}

function renderNeedsWantsChart() {
    const container = document.getElementById('needsWantsChartContainer');
    if (!container) return;

    const categories = state.store.currentBudget.categories || [];
    const totalSpent = categories.reduce((sum, cat) => sum + (cat.spent || 0), 0);

    if (totalSpent === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 mt-8">No spending data for this month yet.</p>`;
        return;
    }

    const spendingByType = { 'Needs': 0, 'Wants': 0, 'Savings': 0 };
    categories.forEach(cat => {
        if (spendingByType[cat.type] !== undefined) {
            spendingByType[cat.type] += (cat.spent || 0);
        }
    });
    
    container.innerHTML = `<canvas id="needsWantsChartCanvas"></canvas>`;
    const canvas = document.getElementById('needsWantsChartCanvas');
    const ctx = canvas.getContext('2d');

    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(spendingByType),
            datasets: [{
                label: 'Spending',
                data: Object.values(spendingByType),
                backgroundColor: ['#3B82F6', '#F59E0B', '#10B981'],
                borderColor: '#ffffff',
                borderWidth: 4,
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
    state.setNeedsWantsChart(chart);
}

function renderBudgetHotspots() {
    const container = document.getElementById('budgetHotspotsList');
    if (!container) return;

    const categories = (state.store.currentBudget.categories || [])
        .filter(c => (c.allocated || 0) > 0)
        .map(c => ({...c, percentage: ((c.spent || 0) / c.allocated) * 100 }))
        .sort((a,b) => b.percentage - a.percentage)
        .slice(0, 5);

    if (categories.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500">No categories with allocated budgets.</p>`;
        return;
    }

    container.innerHTML = categories.map(cat => {
        const color = cat.percentage > 100 ? 'bg-red-500' : (cat.percentage > 75 ? 'bg-yellow-500' : 'bg-blue-500');
        return `
            <div class="hotspot-item">
                <div class="flex items-center gap-2">
                    <span class="font-semibold text-sm">${cat.name}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs font-mono">${cat.percentage.toFixed(0)}%</span>
                    <div class="progress-bar-container w-24">
                        <div class="progress-bar-fill ${color}" style="width: ${Math.min(100, cat.percentage)}%"></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function renderHistoricalCharts() {
    const histContainer = document.getElementById('historicalSavingsChartContainer');
    const deepDiveContainer = document.getElementById('categoryDeepDiveContainer');
    const deepDiveSelect = document.getElementById('categoryDeepDiveSelect');
    if (!histContainer || !deepDiveContainer || !deepDiveSelect) return;

    try {
        const snapshot = await firestore.getArchivedBudgets(state.store.userId, state.store.activeBudgetId);
        if (snapshot.empty || snapshot.docs.length < 2) {
            histContainer.innerHTML = `<p class="text-center text-gray-500 mt-8">Archive at least two months to see trends.</p>`;
            deepDiveContainer.innerHTML = `<p class="text-center text-gray-500 mt-8">Not enough data for a deep dive.</p>`;
            deepDiveSelect.innerHTML = '';
            return;
        }

        const archives = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id));
        const labels = archives.map(archive => archive.id);
        const totalSpentData = archives.map(archive => (archive.categories || []).reduce((sum, cat) => sum + (cat.spent || 0), 0));
        const incomeData = archives.map(a => (a.incomeTransactions || []).reduce((sum, t) => sum + t.amount, 0));
        const netSavingsData = incomeData.map((income, i) => income - totalSpentData[i]);

        histContainer.innerHTML = `<canvas id="historicalSavingsChartCanvas"></canvas>`;
        const ctx = document.getElementById('historicalSavingsChartCanvas').getContext('2d');
        const histChart = new Chart(ctx, { type: 'line', data: { labels, datasets: [ { label: 'Total Spent', data: totalSpentData, borderColor: '#EF4444' }, { label: 'Total Income', data: incomeData, borderColor: '#22C55E', borderDash: [5, 5] }, { label: 'Net Savings', data: netSavingsData, borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.2 } ] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } });
        state.setHistoricalSavingsChart(histChart);

        const allCategoryNames = [...new Set(archives.flatMap(a => (a.categories || []).map(c => c.name)))];
        deepDiveSelect.innerHTML = allCategoryNames.map(name => `<option value="${name}">${name}</option>`).join('');

        const renderDeepDive = () => {
            const selectedCategory = deepDiveSelect.value;
            if (!selectedCategory) { deepDiveContainer.innerHTML = ''; return; }
            const categoryData = archives.map(archive => { const category = (archive.categories || []).find(c => c.name === selectedCategory); return category ? (category.spent || 0) : 0; });
            deepDiveContainer.innerHTML = `<canvas id="categoryDeepDiveCanvas"></canvas>`;
            const deepDiveCtx = document.getElementById('categoryDeepDiveCanvas').getContext('2d');
            const ddChart = new Chart(deepDiveCtx, { type: 'bar', data: { labels, datasets: [{ label: `Spending for ${selectedCategory}`, data: categoryData, backgroundColor: '#8B5CF6' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } });
            state.setCategoryDeepDiveChart(ddChart);
        };
        deepDiveSelect.onchange = renderDeepDive;
        renderDeepDive();
    } catch(error) {
        utils.logError('ui.renderHistoricalCharts', error);
        histContainer.innerHTML = `<p class="text-center text-red-500 mt-8">Could not load historical data.</p>`;
    }
}

// --- EVENT HANDLERS & MODAL LOGIC ---

async function handleBudgetSwitch() { try { const newBudgetId = dom.budgetSelector.value; if (newBudgetId === state.store.activeBudgetId) return; setUIState('loading'); await firestore.saveActiveBudgetId(state.store.userId, newBudgetId); state.setActiveBudgetId(newBudgetId); await firestore.setupBudgetListener(state.store.userId, newBudgetId); } catch (error) { utils.logError('ui.handleBudgetSwitch', error); setUIState('error', { message: 'Could not switch budgets.' }); } }
async function handleAddNewBudget() { try { const name = prompt("Enter a name for the new budget:", "New Budget"); if (name) { setUIState('loading'); const newBudget = await firestore.createNewBudget(state.store.userId, name); if (newBudget) { state.updateAllBudgets(newBudget.id, newBudget.name); populateBudgetSelector(); dom.budgetSelector.value = newBudget.id; await handleBudgetSwitch(); } } } catch (error) { utils.logError('ui.handleAddNewBudget', error); setUIState('loaded'); } }
async function deleteCurrentBudget() { if (Object.keys(state.store.allBudgets).length <= 1) { showNotification("You cannot delete your only budget.", "danger"); return; } const budgetNameToDelete = state.store.allBudgets[state.store.activeBudgetId]; const confirmed = await showConfirmModal(`Delete "${budgetNameToDelete}"?`, "This is permanent and will delete all associated data for this budget."); if (confirmed) { setUIState('loading'); try { const idToDelete = state.store.activeBudgetId; await firestore.deleteBudget(state.store.userId, idToDelete); state.deleteFromAllBudgets(idToDelete); const newActiveId = Object.keys(state.store.allBudgets)[0]; dom.budgetSelector.value = newActiveId; await handleBudgetSwitch(); populateBudgetSelector(); showNotification(`Budget "${budgetNameToDelete}" deleted.`, 'success'); } catch (error) { utils.logError('ui.deleteCurrentBudget', error); setUIState('loaded'); } } }
async function handleArchiveMonth() { const confirmed = await showConfirmModal('Archive Month?', 'This will save a snapshot and reset all transactions for the new month.'); if (confirmed) { try { const now = new Date(); const archiveId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; const archiveDocRef = doc(firestore.db, `artifacts/${appId}/users/${state.store.userId}/budgets/${state.store.activeBudgetId}/archive/${archiveId}`); await setDoc(archiveDocRef, state.store.currentBudget); state.store.currentBudget.transactions = []; state.store.currentBudget.incomeTransactions = []; state.store.currentBudget.categories.forEach(c => c.spent = 0); await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget); showNotification(`Budget for ${archiveId} has been archived.`, 'success'); } catch (error) { utils.logError('ui.handleArchiveMonth', error); showNotification("Archiving failed. Please try again.", "danger"); } } }
function handleTransactionListClick(e) { const itemElement = e.target.closest('.transaction-item'); if (!itemElement) return; const id = itemElement.dataset.id; const type = itemElement.dataset.type; const action = e.target.closest('button')?.dataset.action; if (!action) return; if (action === 'edit-income') { const income = (state.store.currentBudget.incomeTransactions || []).find(i => i.id === id); if(income) openIncomeModal(income); } else if (action === 'delete-income') { handleDeleteIncome(id); } else if (action === 'edit-expense') { const transaction = (state.store.currentBudget.transactions || []).find(t => t.id === id); if(transaction) openTransactionModal(transaction); } else if (action === 'delete-expense') { handleDeleteTransaction(id); } }
async function handleHistoryClick(e) { const viewBtn = e.target.closest('.view-archive-btn'); if (viewBtn) { const archiveId = viewBtn.dataset.archiveId; const archiveDocRef = doc(firestore.db, `artifacts/${appId}/users/${state.store.userId}/budgets/${state.store.activeBudgetId}/archive/${archiveId}`); try { const docSnap = await getDoc(archiveDocRef); if (docSnap.exists()) { renderArchivedMonthDetails(archiveId, docSnap.data()); showModal(CONSTANTS.MODAL_IDS.archivedDetails); } else { showNotification("Could not find archive.", "danger"); } } catch (error) { utils.logError('ui.handleHistoryClick', error); showNotification("Failed to load archive details.", "danger"); } } }
function handleCategoryCardClick(e) { const card = e.target.closest('.category-card'); if (!card) return; const action = e.target.closest('button')?.dataset.action; if (action === 'edit-category') { e.stopPropagation(); state.setEditingCategoryId(card.dataset.categoryId); const category = state.store.currentBudget.categories.find(c => c.id === state.store.editingCategoryId); if (category) openCategoryModal(category); } else if (action === 'delete-category') { e.stopPropagation(); handleDeleteCategory(card.dataset.categoryId); } else { dom.tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === 'transactions')); dom.tabPanels.forEach(p => p.classList.toggle('active', p.id === 'tab-transactions')); document.getElementById('filterCategory').value = card.dataset.categoryId; renderTransactionList(); } }

async function handleTransactionFormSubmit(e) { e.preventDefault(); const form = e.target; const submitButton = form.querySelector('button[type="submit"]'); const originalButtonText = submitButton.innerHTML; submitButton.disabled = true; submitButton.innerHTML = `<div class="spinner-small"></div> Saving...`; try { const newTransactionId = state.store.editingTransactionId || `trans-${Date.now()}`; const newTransaction = { id: newTransactionId, amount: parseFloat(document.getElementById('modalTransactionAmount').value), categoryId: document.getElementById('modalTransactionCategory').value, subcategory: document.getElementById('modalTransactionSubcategory').value, paymentMethod: document.getElementById('modalTransactionPaymentMethod').value, description: document.getElementById('modalTransactionDescription').value, date: document.getElementById('modalTransactionDate').value, }; if (!state.store.currentBudget.transactions) state.store.currentBudget.transactions = []; if (state.store.editingTransactionId) { const index = state.store.currentBudget.transactions.findIndex(t => t.id === state.store.editingTransactionId); if (index > -1) state.store.currentBudget.transactions[index] = newTransaction; } else { state.store.currentBudget.transactions.push(newTransaction); state.setLastAddedItemId(newTransactionId); } state.recalculateSpentAmounts(); await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget); hideModal(CONSTANTS.MODAL_IDS.transaction); showNotification('Expense saved.', 'success'); } catch (error) { utils.logError('ui.handleTransactionFormSubmit', error); showNotification("Failed to save expense.", "danger"); } finally { submitButton.disabled = false; submitButton.innerHTML = originalButtonText; state.setEditingTransactionId(null); } }
async function handleIncomeFormSubmit(e) { e.preventDefault(); const form = e.target; const submitButton = form.querySelector('button[type="submit"]'); const originalButtonText = submitButton.innerHTML; submitButton.disabled = true; submitButton.innerHTML = `<div class="spinner-small"></div> Saving...`; try { const newIncomeId = state.store.editingIncomeId || `income-${Date.now()}`; const newIncome = { id: newIncomeId, amount: parseFloat(document.getElementById('modalIncomeAmount').value), description: document.getElementById('modalIncomeDescription').value, date: document.getElementById('modalIncomeDate').value }; if (!state.store.currentBudget.incomeTransactions) state.store.currentBudget.incomeTransactions = []; if (state.store.editingIncomeId) { const index = state.store.currentBudget.incomeTransactions.findIndex(i => i.id === state.store.editingIncomeId); if (index > -1) state.store.currentBudget.incomeTransactions[index] = newIncome; } else { state.store.currentBudget.incomeTransactions.push(newIncome); state.setLastAddedItemId(newIncomeId); } await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget); hideModal(CONSTANTS.MODAL_IDS.income); showNotification('Income saved.', 'success'); } catch (error) { utils.logError('ui.handleIncomeFormSubmit', error); showNotification("Failed to save income.", "danger"); } finally { submitButton.disabled = false; submitButton.innerHTML = originalButtonText; state.setEditingIncomeId(null); } }
async function handleCategoryFormSubmit(e) { e.preventDefault(); const form = e.target; const submitButton = form.querySelector('button[type="submit"]'); const originalButtonText = submitButton.innerHTML; submitButton.disabled = true; submitButton.innerHTML = `<div class="spinner-small"></div> Saving...`; try { const name = document.getElementById('modalCategoryName').value; const allocated = parseFloat(document.getElementById('modalAllocatedAmount').value); const type = document.getElementById('modalCategoryType').value; if (state.store.editingCategoryId) { const category = state.store.currentBudget.categories.find(c => c.id === state.store.editingCategoryId); if (category) { category.name = name; category.allocated = allocated; category.type = type; } } else { if (!state.store.currentBudget.categories) state.store.currentBudget.categories = []; state.store.currentBudget.categories.push({ id: name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(), name, allocated, spent: 0, type, color: `#${(Math.random()*0xFFFFFF<<0).toString(16).padStart(6,'0')}`, icon: defaultCategoryIcon }); } await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget); hideModal(CONSTANTS.MODAL_IDS.category); showNotification(`Category saved successfully.`, 'success'); } catch (error) { utils.logError('ui.handleCategoryFormSubmit', error); showNotification("Failed to save category.", "danger"); } finally { submitButton.disabled = false; submitButton.innerHTML = originalButtonText; state.setEditingCategoryId(null); } }
async function handleDeleteTransaction(transactionId) { const confirmed = await showConfirmModal('Delete Transaction?', 'Are you sure you want to delete this transaction?'); if (confirmed) { try { state.store.currentBudget.transactions = state.store.currentBudget.transactions.filter(t => t.id !== transactionId); state.recalculateSpentAmounts(); await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget); showNotification('Transaction deleted.', 'success'); } catch (error) { utils.logError('ui.handleDeleteTransaction', error); showNotification("Failed to delete transaction.", "danger"); } } }
async function handleDeleteIncome(incomeId) { const confirmed = await showConfirmModal('Delete Income?', 'Are you sure you want to delete this income entry?'); if (confirmed) { try { state.store.currentBudget.incomeTransactions = state.store.currentBudget.incomeTransactions.filter(i => i.id !== incomeId); await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget); showNotification('Income deleted.', 'success'); } catch (error) { utils.logError('ui.handleDeleteIncome', error); showNotification("Failed to delete income.", "danger"); } } }
async function handleDeleteCategory(categoryId) { const category = state.store.currentBudget.categories.find(c => c.id === categoryId); if (!category) return; const confirmed = await showConfirmModal('Delete Category?', `Are you sure you want to delete the "${category.name}" category? All associated transactions will also be deleted.`); if (confirmed) { try { state.store.currentBudget.categories = state.store.currentBudget.categories.filter(c => c.id !== categoryId); state.store.currentBudget.transactions = (state.store.currentBudget.transactions || []).filter(t => t.categoryId !== categoryId); state.recalculateSpentAmounts(); await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget); showNotification(`Category "${category.name}" deleted.`, 'success'); } catch (error) { utils.logError('ui.handleDeleteCategory', error); showNotification("Failed to delete category.", "danger"); } } }

// --- Other UI functions ---
// (This space is for functions like openModal, populateFilters, etc.)
