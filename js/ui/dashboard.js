import * as state from '../state.js';
import { dom } from './core.js';
import { defaultCategoryIcon } from '../config.js';

const observer = new IntersectionObserver((entries) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }); }, { threshold: 0.1 });

/**
 * Main render function for the Dashboard tab.
 */
export function renderDashboard() {
    if (!state.store.currentBudget) return;
    renderSummary();
    renderCategories();
}

/**
 * Renders the main summary card with income, expenses, and net flow.
 */
function renderSummary() {
    const totalIncome = state.store.calculateTotalIncome();
    const totalSpent = (state.store.currentBudget.categories || []).reduce((sum, cat) => sum + (cat.spent || 0), 0);
    const netFlow = totalIncome - totalSpent;
    const spentPercentage = totalIncome > 0 ? (totalSpent / totalIncome) * 100 : 0;
    
    const totalBudgetValueEl = document.getElementById('totalBudgetValue');
    const totalSpentValueEl = document.getElementById('totalSpentValue');
    const remainingEl = document.getElementById('overallRemainingValue');
    const overallProgressBarEl = document.getElementById('overallProgressBar');

    if (totalBudgetValueEl) totalBudgetValueEl.textContent = totalIncome.toFixed(2);
    if (totalSpentValueEl) totalSpentValueEl.textContent = totalSpent.toFixed(2);
    
    if (remainingEl) {
        remainingEl.textContent = netFlow.toFixed(2);
        remainingEl.className = `font-bold ${netFlow < 0 ? 'text-red-600' : 'text-green-600'}`;
    }
    
    if (overallProgressBarEl) {
        requestAnimationFrame(() => {
            overallProgressBarEl.style.width = `${Math.min(100, spentPercentage)}%`;
        });
    }
}

/**
 * Renders all the category sections and cards on the dashboard.
 */
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

/**
 * Creates the HTML string for a single category card.
 * @param {object} category - The category data object.
 * @returns {string} The HTML string for the card.
 */
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
