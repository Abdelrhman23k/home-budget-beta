import { CONSTANTS } from './config.js';

export let dom = {};

/**
 * Finds all necessary HTML elements and stores them in the `dom` object for easy access.
 * This should be called once after the DOM is fully loaded.
 */
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

/**
 * Manages the overall visual state of the application.
 * @param {'loading' | 'loaded' | 'error'} uiState - The state to display.
 * @param {object} options - Additional options, like an error message.
 */
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

/**
 * Renders the user ID in the header.
 * @param {string} userId - The user's unique ID.
 */
export function renderUserId(userId) {
    if (dom.userIdValue) dom.userIdValue.textContent = userId;
    if (dom.userIdDisplay) dom.userIdDisplay.classList.remove('hidden');
}


/**
 * Displays a temporary notification at the bottom of the screen.
 * @param {string} message - The message to display.
 * @param {'info' | 'success' | 'danger'} type - The type of notification.
 * @param {number} duration - How long to display the message in milliseconds.
 */
export function showNotification(message, type = 'info', duration = 3000) {
    const el = document.getElementById('inlineNotification');
    if (!el) return;
    el.textContent = message;
    el.className = 'hidden';
    void el.offsetWidth;
    el.classList.add(type, 'show');
    setTimeout(() => {
        el.classList.remove('show');
    }, duration);
}

/**
 * Shows a modal dialog by its ID.
 * @param {string} id - The ID of the modal overlay to show.
 */
export function showModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('hidden');
}

/**
 * Hides a modal dialog by its ID.
 * @param {string} id - The ID of the modal overlay to hide.
 */
export function hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
}

/**
 * Displays a confirmation modal and returns a promise that resolves with the user's choice.
 * @param {string} title - The title of the confirmation.
 * @param {string} message - The descriptive message.
 * @returns {Promise<boolean>} - A promise that resolves to `true` if confirmed, `false` otherwise.
 */
export async function showConfirmModal(title, message) {
    const modalId = CONSTANTS.MODAL_IDS.confirm;
    const modal = document.getElementById(modalId);
    if (!modal) return Promise.resolve(false);

    modal.innerHTML = `
        <div class="custom-modal-content">
            <h2 class="custom-modal-title">${title}</h2>
            <p class="text-center text-gray-600 mb-6">${message}</p>
            <div class="custom-modal-buttons justify-center">
                <button class="custom-modal-button custom-modal-cancel">Cancel</button>
                <button class="custom-modal-button custom-modal-confirm">Confirm</button>
            </div>
        </div>`;
    showModal(modalId);

    return new Promise(resolve => {
        modal.querySelector('.custom-modal-confirm').onclick = () => { hideModal(modalId); resolve(true); };
        modal.querySelector('.custom-modal-cancel').onclick = () => { hideModal(modalId); resolve(false); };
    });
}

/**
 * Populates the main budget selector dropdown with the available budgets.
 */
export function populateBudgetSelector() {
    const { allBudgets, activeBudgetId } = state.store;
    if (!dom.budgetSelector) return;
    
    dom.budgetSelector.innerHTML = '';
    for (const id in allBudgets) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = allBudgets[id];
        dom.budgetSelector.appendChild(option);
    }
    
    if (activeBudgetId) {
        dom.budgetSelector.value = activeBudgetId;
    }

    const deleteButton = document.getElementById('deleteBudgetButton');
    if (deleteButton) {
        deleteButton.disabled = Object.keys(allBudgets).length <= 1;
    }
}
