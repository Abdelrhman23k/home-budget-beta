import * as state from '../state.js';
import * as utils from '../utils.js';
import { dom } from '../ui.js';

/**
 * Main render function for the Transactions tab.
 */
export function renderTransactionsPage() {
    if (!state.store.currentBudget) return;
    populateTransactionFilters();
    renderTransactionList();
}

/**
 * Populates the filter dropdowns for category and payment method.
 */
function populateTransactionFilters() {
    const filterCategory = document.getElementById('filterCategory');
    const filterPaymentMethod = document.getElementById('filterPaymentMethod');
    if (!filterCategory || !filterPaymentMethod) return;

    let currentCategoryValue = filterCategory.value;
    filterCategory.innerHTML = '<option value="all">All Categories</option>';
    const validCategoryOptions = ['all'];
    (state.store.currentBudget.categories || []).forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        filterCategory.appendChild(option);
        validCategoryOptions.push(cat.id);
    });
    filterCategory.value = validCategoryOptions.includes(currentCategoryValue) ? currentCategoryValue : 'all';
    
    let currentPaymentValue = filterPaymentMethod.value;
    filterPaymentMethod.innerHTML = '<option value="all">All Payment Methods</option>';
    const validPaymentOptions = ['all'];
    (state.store.currentBudget.paymentMethods || []).forEach(pm => {
        const option = document.createElement('option');
        option.value = pm;
        option.textContent = pm;
        filterPaymentMethod.appendChild(option);
        validPaymentOptions.push(pm);
    });
    filterPaymentMethod.value = validPaymentOptions.includes(currentPaymentValue) ? currentPaymentValue : 'all';
}

/**
 * Renders the combined list of income and expense transactions.
 */
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

/**
 * Creates the HTML string for a single item in the transaction list.
 * @param {object} item - The transaction or income data object.
 * @returns {string} The HTML string for the list item.
 */
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
        const category = (state.store.currentBudget.categories || []).find(c => c.id === item.categoryId);
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
