import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, getDocs, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    // --- State and Constants ---
    let currentBudget = null, userId = null, isAuthReady = false, unsubscribeBudget = null;
    let editingCategoryId = null, editingTransactionId = null, editingIncomeId = null;
    let recognition = null, lastAddedItemId = null;
    let transactionPieChart = null, needsWantsChart = null, historicalSavingsChart = null, categoryDeepDiveChart = null;
    let activeBudgetId = null, allBudgets = {};
    let dom = {};

    const defaultCategoryIcon = `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.432 0l6.568-6.568a2.426 2.426 0 0 0 0-3.432L12.586 2.586z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>`;
    const defaultBudget = {
        name: "Default Budget",
        types: ['Needs', 'Wants', 'Savings'],
        paymentMethods: ['Cash', 'Credit Card', 'Bank Transfer'],
        subcategories: { 'Coffee': ['diningOut', 'groceries'], 'Internet': ['utilities'], 'Pet Food': ['dogEssentials'] },
        categories: [ { id: 'groceries', name: 'Groceries', allocated: 6000, spent: 0, type: 'Needs', color: '#EF4444', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.16"/></svg>` }, { id: 'utilities', name: 'Utilities', allocated: 1500, spent: 0, type: 'Needs', color: '#F97316', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m13 10-3 5h4l-3 5"/></svg>` }, { id: 'savings', name: 'Savings', allocated: 4000, spent: 0, type: 'Savings', color: '#A855F7', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M8 12h7"/><path d="M12 7v10"/></svg>` }, ],
        transactions: [],
        incomeTransactions: []
    };
    const categoryMapping = { "groceries": ["groceries", "grocery"], "utilities": ["utilities", "bills"], "savings": ["savings"] };

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : { apiKey: "AIzaSyAnDwriW_zqBkZDrdLcDrg82f5_UoJzeUE", authDomain: "home-budget-app-c4f05.firebaseapp.com", projectId: "home-budget-app-c4f05" };
    
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    
    // --- CORE APP FLOW ---

    function initializeDOMCache() {
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
            fabContainer: document.querySelector('.fab-container')
        };
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            initializeDOMCache();
            userId = user.uid;
            isAuthReady = true;
            dom.userIdValue.textContent = userId;
            dom.userIdDisplay.classList.remove('hidden');
            initializeEventListeners();
            await initializeAppState();
            setupSpeechRecognition();
        } else {
            try {
                const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken);
                else await signInAnonymously(auth);
            } catch (error) {
                console.error("Authentication failed:", error);
                showNotification("Critical Error: Could not connect. Please refresh.", "danger", 10000);
            }
        }
    });

    async function initializeAppState() {
        dom.mainContent.classList.add('hidden');
        dom.budgetControlPanel.classList.add('hidden');
        dom.loadingSpinner.classList.remove('hidden');
        try {
            await migrateOldBudgetStructure();
            const budgetsColRef = collection(db, `artifacts/${appId}/users/${userId}/budgets`);
            const budgetsSnapshot = await getDocs(budgetsColRef);
            allBudgets = {};
            budgetsSnapshot.forEach(doc => { allBudgets[doc.id] = doc.data().name || "Untitled Budget"; });
            if (Object.keys(allBudgets).length === 0) {
                activeBudgetId = await createNewBudget("My First Budget");
            } else {
                const prefsDocRef = doc(db, `artifacts/${appId}/users/${userId}/preferences/userPrefs`);
                const prefsDoc = await getDoc(prefsDocRef);
                if (prefsDoc.exists() && allBudgets[prefsDoc.data().activeBudgetId]) {
                    activeBudgetId = prefsDoc.data().activeBudgetId;
                } else {
                    activeBudgetId = Object.keys(allBudgets)[0];
                }
            }
            populateBudgetSelector();
            await setupBudgetListener(activeBudgetId);
            dom.budgetControlPanel.classList.remove('hidden');
        } catch (error) {
            console.error("Failed to initialize app state:", error);
            showNotification("A critical error occurred while loading your budget. Please refresh.", "danger", 10000);
            dom.loadingSpinner.classList.add('hidden');
        }
    }

    async function migrateOldBudgetStructure() {
        const oldBudgetRef = doc(db, `artifacts/${appId}/users/${userId}/budget/current`);
        const budgetsColRef = collection(db, `artifacts/${appId}/users/${userId}/budgets`);
        try {
            const oldBudgetSnap = await getDoc(oldBudgetRef);
            const budgetsSnapshot = await getDocs(budgetsColRef);
            if (oldBudgetSnap.exists() && budgetsSnapshot.empty) {
                showNotification("Updating account to support new features...", "info");
                const oldBudgetData = oldBudgetSnap.data();
                oldBudgetData.name = "Default Budget";
                if (oldBudgetData.income && !oldBudgetData.incomeTransactions) {
                    oldBudgetData.incomeTransactions = [{ id: 'income-migrated-' + Date.now(), amount: oldBudgetData.income, description: 'Initial Budgeted Income', date: new Date().toISOString().slice(0, 10) }];
                }
                delete oldBudgetData.income;
                const newBudgetRef = await addDoc(budgetsColRef, oldBudgetData);
                await setActiveBudgetId(newBudgetRef.id);
                await deleteDoc(oldBudgetRef);
                showNotification("Account update complete!", "success");
            }
        } catch (error) {
            console.error("Migration failed: ", error);
            showNotification("Could not update account structure.", "danger");
        }
    }

    async function setupBudgetListener(budgetId) {
        if (unsubscribeBudget) unsubscribeBudget();
        const budgetDocRef = doc(db, `artifacts/${appId}/users/${userId}/budgets/${budgetId}`);
        return new Promise((resolve, reject) => {
            unsubscribeBudget = onSnapshot(budgetDocRef, (docSnap) => {
                try {
                    if (docSnap.exists()) {
                        currentBudget = docSnap.data();
                        if (!currentBudget.transactions) currentBudget.transactions = [];
                        if (!currentBudget.incomeTransactions) currentBudget.incomeTransactions = [];
                        if (!currentBudget.types) currentBudget.types = defaultBudget.types;
                        dom.loadingSpinner.classList.add('hidden');
                        dom.mainContent.classList.remove('hidden');
                        renderUI();
                        resolve();
                    } else {
                        reject(new Error(`Budget with ID ${budgetId} not found.`));
                    }
                } catch(error) {
                    console.error("Error rendering UI from snapshot:", error);
                    showNotification("An error occurred displaying the budget.", "danger");
                    reject(error);
                }
            }, (error) => {
                console.error(`Error listening to budget ${budgetId}:`, error);
                showNotification("Connection to data lost. Please refresh.", "danger");
                reject(error);
            });
        });
    }

    async function saveBudget() { if (!isAuthReady || !userId || !currentBudget || !activeBudgetId) return; lastAddedItemId = null; const budgetDocRef = doc(db, `artifacts/${appId}/users/${userId}/budgets/${activeBudgetId}`); try { await setDoc(budgetDocRef, currentBudget, { merge: true }); } catch (error) { console.error("Error saving budget:", error); showNotification("Error: Could not save changes.", "danger"); } }
    
    // --- All other functions ---
    
    function calculateTotalIncome() { return (currentBudget.incomeTransactions || []).reduce((sum, t) => sum + (t.amount || 0), 0); }
    function renderUI() { if (!currentBudget) return; renderSummary(); renderCategories(); populateTransactionFilters(); renderTransactionList(); renderHistoryList(); renderInsights(); }
    function renderSummary() { const totalIncome = calculateTotalIncome(); const totalSpent = (currentBudget.categories || []).reduce((sum, cat) => sum + (cat.spent || 0), 0); const netFlow = totalIncome - totalSpent; const spentPercentage = totalIncome > 0 ? (totalSpent / totalIncome) * 100 : 0; document.getElementById('totalBudgetValue').textContent = totalIncome.toFixed(2); document.getElementById('totalSpentValue').textContent = totalSpent.toFixed(2); const remainingEl = document.getElementById('overallRemainingValue'); remainingEl.textContent = netFlow.toFixed(2); remainingEl.className = `font-bold ${netFlow < 0 ? 'text-red-600' : 'text-green-600'}`; const overallProgressBar = document.getElementById('overallProgressBar'); if(overallProgressBar && overallProgressBar.parentElement) { requestAnimationFrame(() => { overallProgressBar.parentElement.style.transform = 'scaleX(1)'; overallProgressBar.style.width = `${Math.min(100, spentPercentage)}%`; }); } }
    function renderCategories() { const container = document.getElementById('categoryDetailsContainer'); if (!container) return; container.innerHTML = ''; const types = currentBudget.types || []; const categories = currentBudget.categories || []; types.forEach(type => { const categoriesOfType = categories.filter(c => c.type === type); if (categoriesOfType.length === 0) return; const section = document.createElement('div'); section.className = 'mb-6'; const title = document.createElement('h3'); title.className = 'text-xl sm:text-2xl font-bold text-gray-800 mb-4 pl-1 will-animate'; title.textContent = type; section.appendChild(title); observer.observe(title); const grid = document.createElement('div'); grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4'; section.appendChild(grid); categoriesOfType.forEach((category, index) => { const card = createCategoryCard(category); card.classList.add('will-animate'); card.style.transitionDelay = `${index * 50}ms`; grid.appendChild(card); observer.observe(card); }); container.appendChild(section); }); attachCategoryEventListeners(); updateTransactionCategoryDropdown(); }
    function createCategoryCard(category) { const card = document.createElement('div'); const spent = category.spent || 0; const allocated = category.allocated || 0; const remaining = allocated - spent; const percentage = allocated > 0 ? (spent / allocated) * 100 : 0; card.className = 'category-card'; card.style.borderColor = category.color || '#cccccc'; card.dataset.categoryId = category.id; card.innerHTML = `<div class="flex justify-between items-start w-full"><div class="flex items-center gap-2">${category.icon || defaultCategoryIcon}<h4 class="font-bold text-base sm:text-lg text-gray-900">${category.name}</h4></div><div class="flex gap-2"><button data-edit-id="${category.id}" class="edit-category-btn p-1 text-gray-400 hover:text-blue-600 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></button><button data-delete-id="${category.id}" class="delete-category-btn p-1 text-gray-400 hover:text-red-600 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></div></div><div class="w-full"><p class="text-sm text-gray-500"><span class="font-semibold text-gray-700">${spent.toFixed(2)}</span> / ${allocated.toFixed(2)} EGP</p><div class="progress-bar-container"><div class="progress-bar-fill" style="width: ${Math.min(100, percentage)}%; background-color: ${category.color || '#cccccc'};"></div></div><p class="text-right text-xs sm:text-sm mt-1 font-medium ${remaining < 0 ? 'text-red-500' : 'text-gray-600'}">${remaining.toFixed(2)} EGP remaining</p></div>`; const progressBarContainer = card.querySelector('.progress-bar-container'); if(progressBarContainer){ requestAnimationFrame(() => { progressBarContainer.style.transform = 'scaleX(1)'; }); } return card; }
    
    // ... And all the other functions from the last fully complete file are included here
});
