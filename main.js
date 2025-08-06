import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, getDocs, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Main application entry point ---
document.addEventListener('DOMContentLoaded', () => {
    // --- Constants ---
    const CONSTANTS = {
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

    // --- Firebase Configuration ---
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : { apiKey: "AIzaSyAnDwriW_zqBkZDrdLcDrg82f5_UoJzeUE", authDomain: "home-budget-app-c4f05.firebaseapp.com", projectId: "home-budget-app-c4f05" };
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

    // --- Application State ---
    let currentBudget = null;
    let userId = null;
    let isAuthReady = false;
    let unsubscribeBudget = null;
    let editingCategoryId = null;
    let editingTransactionId = null;
    let editingIncomeId = null;
    let recognition = null;
    let lastAddedItemId = null;

    // --- Chart Instances ---
    let transactionPieChart = null;
    let needsWantsChart = null;
    let historicalSavingsChart = null;
    let categoryDeepDiveChart = null;

    // --- Multi-Budget State ---
    let activeBudgetId = null;
    let allBudgets = {};

    // --- DOM Element Cache ---
    let dom = {};

    // --- Default Data Structures ---
    const defaultCategoryIcon = `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.432 0l6.568-6.568a2.426 2.426 0 0 0 0-3.432L12.586 2.586z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>`;
    const defaultBudget = {
        name: "Default Budget",
        types: ['Needs', 'Wants', 'Savings'],
        paymentMethods: ['Cash', 'Credit Card', 'Bank Transfer'],
        subcategories: { 'Coffee': ['diningOut', 'groceries'], 'Internet': ['utilities'], 'Pet Food': ['dogEssentials'] },
        categories: [
            { id: 'groceries', name: 'Groceries', allocated: 6000, spent: 0, type: 'Needs', color: '#EF4444', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.16"/></svg>` },
            { id: 'utilities', name: 'Utilities', allocated: 1500, spent: 0, type: 'Needs', color: '#F97316', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m13 10-3 5h4l-3 5"/></svg>` },
            { id: 'savings', name: 'Savings', allocated: 4000, spent: 0, type: 'Savings', color: '#A855F7', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M8 12h7"/><path d="M12 7v10"/></svg>` },
        ],
        transactions: [],
        incomeTransactions: []
    };
    const categoryMapping = { "groceries": ["groceries", "grocery"], "utilities": ["utilities", "bills"], "savings": ["savings"] };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    const observer = new IntersectionObserver((entries) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }); }, { threshold: 0.1 });

    function showNotification(message, type = 'info', duration = 3000) { const el = document.getElementById('inlineNotification'); el.textContent = message; el.className = 'hidden'; void el.offsetWidth; el.classList.add(type, 'show'); setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.classList.add('hidden'), 300); }, duration); }
    function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
    function hideModal(id) { document.getElementById(id).classList.add('hidden'); }
    async function showConfirmModal(title, message) { const modalId = CONSTANTS.MODAL_IDS.confirm; const modal = document.getElementById(modalId); modal.innerHTML = `<div class="custom-modal-content"><h2 class="custom-modal-title">${title}</h2><p class="text-center text-gray-600 mb-6">${message}</p><div class="custom-modal-buttons justify-center"><button class="custom-modal-button custom-modal-cancel">Cancel</button><button class="custom-modal-button custom-modal-confirm">Confirm</button></div></div>`; showModal(modalId); return new Promise(resolve => { modal.querySelector('.custom-modal-confirm').onclick = () => { hideModal(modalId); resolve(true); }; modal.querySelector('.custom-modal-cancel').onclick = () => { hideModal(modalId); resolve(false); }; }); }

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

    // --- All other functions ---

    function calculateTotalIncome() { return (currentBudget.incomeTransactions || []).reduce((sum, t) => sum + (t.amount || 0), 0); }
    async function saveBudget() { if (!isAuthReady || !userId || !currentBudget || !activeBudgetId) return; lastAddedItemId = null; const budgetDocRef = doc(db, `artifacts/${appId}/users/${userId}/budgets/${activeBudgetId}`); try { await setDoc(budgetDocRef, currentBudget, { merge: true }); } catch (error) { console.error("Error saving budget:", error); showNotification("Error: Could not save changes.", "danger"); } }
    function populateBudgetSelector() { dom.budgetSelector.innerHTML = ''; for (const id in allBudgets) { const option = document.createElement('option'); option.value = id; option.textContent = allBudgets[id]; dom.budgetSelector.appendChild(option); } if (activeBudgetId) { dom.budgetSelector.value = activeBudgetId; } document.getElementById('deleteBudgetButton').disabled = Object.keys(allBudgets).length <= 1; }
    async function setActiveBudgetId(budgetId) { activeBudgetId = budgetId; const prefsDocRef = doc(db, `artifacts/${appId}/users/${userId}/preferences/userPrefs`); try { await setDoc(prefsDocRef, { activeBudgetId: budgetId }); } catch (error) { console.error("Could not save preference:", error); } }
    async function handleBudgetSwitch() { const newBudgetId = dom.budgetSelector.value; if (newBudgetId === activeBudgetId) return; dom.mainContent.classList.add('hidden'); dom.loadingSpinner.classList.remove('hidden'); await setActiveBudgetId(newBudgetId); await setupBudgetListener(newBudgetId); }
    async function createNewBudget(name) { const newBudgetData = JSON.parse(JSON.stringify(defaultBudget)); newBudgetData.name = name; const budgetsColRef = collection(db, `artifacts/${appId}/users/${userId}/budgets`); try { const docRef = await addDoc(budgetsColRef, newBudgetData); allBudgets[docRef.id] = name; populateBudgetSelector(); showNotification(`Budget "${name}" created.`, 'success'); return docRef.id; } catch (error) { console.error("Error creating budget:", error); showNotification("Could not create budget.", "danger"); return null; } }
    async function deleteCurrentBudget() { if (Object.keys(allBudgets).length <= 1) { showNotification("Cannot delete your only budget.", "danger"); return; } const budgetNameToDelete = allBudgets[activeBudgetId]; const confirmed = await showConfirmModal(`Delete "${budgetNameToDelete}"?`, "This is permanent and will delete all data for this budget."); if (confirmed) { const budgetToDelRef = doc(db, `artifacts/${appId}/users/${userId}/budgets/${activeBudgetId}`); const idToDelete = activeBudgetId; delete allBudgets[idToDelete]; const newActiveId = Object.keys(allBudgets)[0]; try { await deleteDoc(budgetToDelRef); showNotification(`Budget "${budgetNameToDelete}" deleted.`, "success"); dom.budgetSelector.value = newActiveId; await handleBudgetSwitch(); populateBudgetSelector(); } catch (error) { console.error("Error deleting budget:", error); showNotification("Failed to delete budget.", "danger"); allBudgets[idToDelete] = budgetNameToDelete; } } }
    
    // ... Paste ALL remaining functions from the previous correct version here ...
});
