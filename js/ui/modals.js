import * as state from '../state.js';
import * as firestore from '../firestore.js';
import { showModal, hideModal, showConfirmModal, showNotification } from '../ui.js';
import { CONSTANTS, defaultCategoryIcon } from '../config.js';
import { logError } from '../utils.js';

// --- CATEGORY MODAL ---

export function openCategoryModal(category = null) {
    state.setEditingCategoryId(category ? category.id : null);
    const modalId = CONSTANTS.MODAL_IDS.category;
    const modal = document.getElementById(modalId);
    if (!modal) return;

    let typeOptions = '';
    (state.store.currentBudget.types || []).forEach(type => {
        const selected = category && category.type === type ? 'selected' : '';
        typeOptions += `<option value="${type}" ${selected}>${type}</option>`;
    });

    modal.innerHTML = `
        <div class="custom-modal-content">
            <h2 class="custom-modal-title">${category ? 'Edit Category' : 'Add New Category'}</h2>
            <form id="categoryForm">
                <div class="mb-4">
                    <label for="modalCategoryName" class="block text-gray-700 text-sm font-bold mb-2">Category Name:</label>
                    <input type="text" id="modalCategoryName" class="form-input" value="${category ? category.name : ''}" required />
                </div>
                <div class="mb-4">
                    <label for="modalAllocatedAmount" class="block text-gray-700 text-sm font-bold mb-2">Allocated Amount (EGP):</label>
                    <input type="number" id="modalAllocatedAmount" class="form-input" min="0" step="0.01" value="${category ? category.allocated : ''}" required />
                </div>
                <div class="mb-6">
                    <label for="modalCategoryType" class="block text-gray-700 text-sm font-bold mb-2">Category Type:</label>
                    <select id="modalCategoryType" class="form-input">${typeOptions}</select>
                </div>
                <div class="custom-modal-buttons">
                    <button type="button" class="custom-modal-button custom-modal-cancel">Cancel</button>
                    <button type="submit" class="custom-modal-button custom-modal-primary-button">${category ? 'Save Changes' : 'Add Category'}</button>
                </div>
            </form>
        </div>
    `;
    showModal(modalId);
    modal.querySelector('form').onsubmit = handleCategoryFormSubmit;
    modal.querySelector('.custom-modal-cancel').onclick = () => hideModal(modalId);
}

async function handleCategoryFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = `<div class="spinner-small"></div> Saving...`;

    try {
        const name = document.getElementById('modalCategoryName').value;
        const allocated = parseFloat(document.getElementById('modalAllocatedAmount').value);
        const type = document.getElementById('modalCategoryType').value;

        if (state.store.editingCategoryId) {
            const category = state.store.currentBudget.categories.find(c => c.id === state.store.editingCategoryId);
            if (category) {
                category.name = name;
                category.allocated = allocated;
                category.type = type;
            }
        } else {
            if (!state.store.currentBudget.categories) state.store.currentBudget.categories = [];
            state.store.currentBudget.categories.push({
                id: name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
                name, allocated, spent: 0, type,
                color: `#${(Math.random()*0xFFFFFF<<0).toString(16).padStart(6,'0')}`,
                icon: defaultCategoryIcon
            });
        }
        await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget);
        hideModal(CONSTANTS.MODAL_IDS.category);
        showNotification(`Category saved successfully.`, 'success');
    } catch (error) {
        logError('ui.handleCategoryFormSubmit', error);
        showNotification("Failed to save category.", "danger");
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
        state.setEditingCategoryId(null);
    }
}

// --- TRANSACTION MODAL ---

export function openTransactionModal(transaction = null) {
    state.setEditingTransactionId(transaction ? transaction.id : null);
    const modalId = CONSTANTS.MODAL_IDS.transaction;
    const modal = document.getElementById(modalId);
    if (!modal) return;

    let paymentMethodOptions = '';
    (state.store.currentBudget.paymentMethods || []).forEach(pm => {
        const selected = transaction && transaction.paymentMethod === pm ? 'selected' : '';
        paymentMethodOptions += `<option value="${pm}" ${selected}>${pm}</option>`;
    });

    modal.innerHTML = `
        <div class="custom-modal-content">
            <h2 class="custom-modal-title">${transaction ? 'Edit Expense' : 'Add New Expense'}</h2>
            <form id="transactionForm">
                <div class="mb-4"><label for="modalTransactionAmount" class="block text-gray-700 text-sm font-bold mb-2">Amount (EGP):</label><input type="number" id="modalTransactionAmount" class="form-input" min="0" step="0.01" value="${transaction ? transaction.amount : ''}" required /></div>
                <div class="mb-4"><label for="modalTransactionCategory" class="block text-gray-700 text-sm font-bold mb-2">Category:</label><select id="modalTransactionCategory" class="form-input" required></select></div>
                <div class="mb-4"><label for="modalTransactionSubcategory" class="block text-gray-700 text-sm font-bold mb-2">Subcategory (Optional):</label><select id="modalTransactionSubcategory" class="form-input"></select></div>
                <div class="mb-4"><label for="modalTransactionPaymentMethod" class="block text-gray-700 text-sm font-bold mb-2">Payment Method:</label><select id="modalTransactionPaymentMethod" class="form-input" required>${paymentMethodOptions}</select></div>
                <div class="mb-4"><label for="modalTransactionDescription" class="block text-gray-700 text-sm font-bold mb-2">Description (Optional):</label><input type="text" id="modalTransactionDescription" class="form-input" value="${transaction ? transaction.description : ''}" /></div>
                <div class="mb-6"><label for="modalTransactionDate" class="block text-gray-700 text-sm font-bold mb-2">Date & Time:</label><input type="datetime-local" id="modalTransactionDate" class="form-input" value="${transaction ? transaction.date : new Date().toISOString().slice(0, 16)}" required /></div>
                <div class="custom-modal-buttons"><button type="button" class="custom-modal-button custom-modal-cancel">Cancel</button><button type="submit" class="custom-modal-button custom-modal-primary-button">${transaction ? 'Save Changes' : 'Add Expense'}</button></div>
            </form>
        </div>
    `;
    updateTransactionCategoryDropdown();
    if(transaction) {
        document.getElementById('modalTransactionCategory').value = transaction.categoryId;
        updateSubcategoryDropdown(transaction.categoryId, transaction.subcategory);
    }
    showModal(modalId);
    modal.querySelector('form').onsubmit = handleTransactionFormSubmit;
    modal.querySelector('.custom-modal-cancel').onclick = () => hideModal(modalId);
    document.getElementById('modalTransactionCategory').onchange = (e) => updateSubcategoryDropdown(e.target.value);
}

async function handleTransactionFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = `<div class="spinner-small"></div> Saving...`;

    try {
        const newTransactionId = state.store.editingTransactionId || `trans-${Date.now()}`;
        const newTransaction = {
            id: newTransactionId,
            amount: parseFloat(document.getElementById('modalTransactionAmount').value),
            categoryId: document.getElementById('modalTransactionCategory').value,
            subcategory: document.getElementById('modalTransactionSubcategory').value,
            paymentMethod: document.getElementById('modalTransactionPaymentMethod').value,
            description: document.getElementById('modalTransactionDescription').value,
            date: document.getElementById('modalTransactionDate').value,
        };

        if (!state.store.currentBudget.transactions) state.store.currentBudget.transactions = [];
        if (state.store.editingTransactionId) {
            const index = state.store.currentBudget.transactions.findIndex(t => t.id === state.store.editingTransactionId);
            if (index > -1) state.store.currentBudget.transactions[index] = newTransaction;
        } else {
            state.store.currentBudget.transactions.push(newTransaction);
            state.setLastAddedItemId(newTransactionId);
        }
        
        state.recalculateSpentAmounts();
        await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget);
        hideModal(CONSTANTS.MODAL_IDS.transaction);
        showNotification('Expense saved.', 'success');
    } catch (error) {
        utils.logError('ui.handleTransactionFormSubmit', error);
        showNotification("Failed to save expense.", "danger");
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
        state.setEditingTransactionId(null);
    }
}

// --- INCOME MODAL ---

export function openIncomeModal(income = null) {
    state.setEditingIncomeId(income ? income.id : null);
    const modalId = CONSTANTS.MODAL_IDS.income;
    const modal = document.getElementById(modalId);
    if(!modal) return;

    modal.innerHTML = `
        <div class="custom-modal-content">
            <h2 class="custom-modal-title">${income ? 'Edit Income' : 'Add New Income'}</h2>
            <form id="incomeForm">
                <div class="mb-4"><label for="modalIncomeAmount" class="block text-gray-700 text-sm font-bold mb-2">Amount (EGP):</label><input type="number" id="modalIncomeAmount" class="form-input" min="0" step="0.01" value="${income ? income.amount : ''}" required /></div>
                <div class="mb-4"><label for="modalIncomeDescription" class="block text-gray-700 text-sm font-bold mb-2">Description (e.g., Salary):</label><input type="text" id="modalIncomeDescription" class="form-input" value="${income ? income.description : ''}" required /></div>
                <div class="mb-6"><label for="modalIncomeDate" class="block text-gray-700 text-sm font-bold mb-2">Date:</label><input type="date" id="modalIncomeDate" class="form-input" value="${income ? income.date : new Date().toISOString().slice(0, 10)}" required /></div>
                <div class="custom-modal-buttons"><button type="button" class="custom-modal-button custom-modal-cancel">Cancel</button><button type="submit" class="custom-modal-button custom-modal-primary-button">${income ? 'Save Changes' : 'Add Income'}</button></div>
            </form>
        </div>
    `;
    showModal(modalId);
    modal.querySelector('form').onsubmit = handleIncomeFormSubmit;
    modal.querySelector('.custom-modal-cancel').onclick = () => hideModal(modalId);
}

async function handleIncomeFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = `<div class="spinner-small"></div> Saving...`;

    try {
        const newIncomeId = state.store.editingIncomeId || `income-${Date.now()}`;
        const newIncome = {
            id: newIncomeId,
            amount: parseFloat(document.getElementById('modalIncomeAmount').value),
            description: document.getElementById('modalIncomeDescription').value,
            date: document.getElementById('modalIncomeDate').value
        };

        if (!state.store.currentBudget.incomeTransactions) state.store.currentBudget.incomeTransactions = [];
        if (state.store.editingIncomeId) {
            const index = state.store.currentBudget.incomeTransactions.findIndex(i => i.id === state.store.editingIncomeId);
            if (index > -1) state.store.currentBudget.incomeTransactions[index] = newIncome;
        } else {
            state.store.currentBudget.incomeTransactions.push(newIncome);
            state.setLastAddedItemId(newIncomeId);
        }
        await firestore.saveBudget(state.store.userId, state.store.activeBudgetId, state.store.currentBudget);
        hideModal(CONSTANTS.MODAL_IDS.income);
        showNotification('Income saved.', 'success');
    } catch (error) {
        utils.logError('ui.handleIncomeFormSubmit', error);
        showNotification("Failed to save income.", "danger");
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
        state.setEditingIncomeId(null);
    }
}


// ... (Other modal and handler functions will be in the next response)
