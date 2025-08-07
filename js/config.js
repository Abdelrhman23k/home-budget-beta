// --- Default Data Structures ---
export const defaultCategoryIcon = `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.432 0l6.568-6.568a2.426 2.426 0 0 0 0-3.432L12.586 2.586z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>`;

export const defaultBudget = {
    name: "Default Budget",
    types: ['Needs', 'Wants', 'Savings'],
    paymentMethods: ['Cash', 'Credit Card', 'Bank Transfer'],
    subcategories: {
        'Coffee': ['diningOut', 'groceries'],
        'Internet': ['utilities'],
        'Pet Food': ['dogEssentials']
    },
    categories: [
        { id: 'groceries', name: 'Groceries', allocated: 6000, spent: 0, type: 'Needs', color: '#EF4444', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.16"/></svg>` },
        { id: 'utilities', name: 'Utilities', allocated: 1500, spent: 0, type: 'Needs', color: '#F97316', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m13 10-3 5h4l-3 5"/></svg>` },
        { id: 'savings', name: 'Savings', allocated: 4000, spent: 0, type: 'Savings', color: '#A855F7', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M8 12h7"/><path d="M12 7v10"/></svg>` },
    ],
    transactions: [],
    incomeTransactions: []
};

export const categoryMapping = {
    "groceries": ["groceries", "grocery"],
    "utilities": ["utilities", "bills"],
    "savings": ["savings"]
};

export const CONSTANTS = {
    MODAL_IDS: {
        category: 'categoryModalOverlay',
        transaction: 'transactionModalOverlay',
        income: 'incomeModalOverlay',
        archivedDetails: 'archivedMonthDetailsModalOverlay',
        confirm: 'confirmModalOverlay',
        manageItems: 'manageItemsModalOverlay',
        manageSubcategories: 'manageSubcategoriesModalOverlay'
    }
};

export const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
export const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : { apiKey: "AIzaSyAnDwriW_zqBkZDrdLcDrg82f5_UoJzeUE", authDomain: "home-budget-app-c4f05.firebaseapp.com", projectId: "home-budget-app-c4f05" };
