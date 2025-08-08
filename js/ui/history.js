import * as state from '../state.js';
import * as firestore from '../firestore.js';
import { dom, showNotification, showModal, hideModal } from '../ui.js';
import { logError, formatTimestamp } from '../utils.js';
import { CONSTANTS } from '../config.js';

/**
 * Main render function for the History tab.
 */
export async function renderHistoryPage() {
    const historyList = dom.monthlyHistoryList;
    if (!historyList || !state.store.activeBudgetId) return;

    historyList.innerHTML = '<div class="spinner"></div>';
    try {
        const snapshot = await firestore.getArchivedBudgets(state.store.userId, state.store.activeBudgetId);
        if (snapshot.empty) {
            historyList.innerHTML = '<p class="text-center text-gray-500">No archives found.</p>';
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
        // The error is already logged and displayed by the firestore function
        historyList.innerHTML = '<p class="text-red-500 text-center">Could not load history.</p>';
    }
}

/**
 * Renders the details of a selected archived month in a modal.
 * @param {string} archiveId - The ID of the archive (e.g., "2025-07").
 * @param {object} data - The full budget object from the archive.
 */
export function renderArchivedMonthDetails(archiveId, data) {
    const modalId = CONSTANTS.MODAL_IDS.archivedDetails;
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const totalIncome = (data.incomeTransactions || []).reduce((sum, t) => sum + t.amount, (data.income || 0));
    const totalSpent = (data.categories || []).reduce((sum, cat) => sum + (cat.spent || 0), 0);
    
    modal.innerHTML = `
        <div class="custom-modal-content" style="max-width: 800px;">
            <h2 class="custom-modal-title">Details for ${archiveId}</h2>
            <div id="archivedMonthContent" class="max-h-[70vh] overflow-y-auto pr-2">
                <div class="bg-indigo-50 p-4 rounded-lg mb-6">
                    <h3 class="text-xl font-bold text-indigo-800 mb-2">Summary</h3>
                    <div class="grid grid-cols-2 gap-4 text-center">
                        <div><p class="text-sm text-gray-600">Total Income</p><p class="font-bold text-lg">${totalIncome.toFixed(2)} EGP</p></div>
                        <div><p class="text-sm text-gray-600">Total Spent</p><p class="font-bold text-lg text-red-600">${totalSpent.toFixed(2)} EGP</p></div>
                    </div>
                </div>
                <h3 class="text-xl font-bold text-gray-800 my-4">Transactions</h3>
                <ul class="space-y-2">${
                    [...(data.transactions || []), ...(data.incomeTransactions || [])]
                    .sort((a,b) => new Date(b.date) - new Date(a.date))
                    .map(t => {
                        const isExpense = !!t.categoryId;
                        const categoryName = isExpense ? (data.categories || []).find(c => c.id === t.categoryId)?.name || 'Uncategorized' : 'Income';
                        return `
                            <li class="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                                <div>
                                    <p class="font-medium">${t.description || 'Transaction'}</p>
                                    <p class="text-sm text-gray-500">${categoryName}・${formatTimestamp(t.date)}</p>
                                </div>
                                <span class="font-bold ${isExpense ? 'text-red-600' : 'text-green-600'}">
                                    ${isExpense ? '-' : '+'}${t.amount.toFixed(2)} EGP
                                </span>
                            </li>`;
                    }).join('') || '<p>No transactions for this month.</p>'
                }</ul>
            </div>
            <div class="custom-modal-buttons justify-center">
                <button type="button" class="custom-modal-button custom-modal-cancel">Close</button>
            </div>
        </div>
    `;
    modal.querySelector('.custom-modal-cancel').onclick = () => hideModal(modalId);
    showModal(modalId);
}
