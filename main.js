import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, getDocs, deleteDoc, addDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Main application entry point ---
document.addEventListener('DOMContentLoaded', () => {
    // --- Constants ---
    const CONSTANTS = {
        MODAL_IDS: {
            category: 'categoryModalOverlay',
            transaction: 'transactionModalOverlay',
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
    let recognition = null;
    let lastAddedTransactionId = null;

    // --- Chart Instances ---
    let transactionPieChart = null;
    let forecastChart = null;
    let needsWantsChart = null;
    let historicalSavingsChart = null;
    let categoryDeepDiveChart = null;

    // --- Multi-Budget State ---
    let activeBudgetId = null;
    let allBudgets = {};

    // --- DOM Element Cache (Initialized later) ---
    let dom = {};

    // --- Default Data Structures ---
    const defaultCategoryIcon = `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.432 0l6.568-6.568a2.426 2.426 0 0 0 0-3.432L12.586 2.586z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>`;
    const defaultBudget = { income: 27725, name: "Default Budget", types: ['Needs', 'Wants', 'Savings'], paymentMethods: ['Cash', 'Credit Card', 'Bank Transfer'], subcategories: { 'Coffee': ['diningOut', 'groceries'], 'Internet': ['utilities'], 'Pet Food': ['dogEssentials'] }, categories: [ { id: 'groceries', name: 'Groceries', allocated: 6000, spent: 0, type: 'Needs', color: '#EF4444', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.16"/></svg>` }, { id: 'utilities', name: 'Utilities', allocated: 1500, spent: 0, type: 'Needs', color: '#F97316', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m13 10-3 5h4l-3 5"/></svg>` }, { id: 'homeOwnership', name: 'Home Ownership', allocated: 1675, spent: 0, type: 'Needs', color: '#EAB308', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>` }, { id: 'fuel', name: 'Fuel for Car', allocated: 2000, spent: 0, type: 'Needs', color: '#22C55E', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></svg>` }, { id: 'healthcare', name: 'Healthcare', allocated: 700, spent: 0, type: 'Needs', color: '#14B8A6', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.7-1 2.1 4.2 3-10.5 1.7 5.3h1.7"/></svg>` }, { id: 'dogEssentials', name: 'Dog Essentials', allocated: 1200, spent: 0, type: 'Needs', color: '#06B6D4', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-7 0V15a5 5 0 0 1 5-5z"/><path d="M12 14v6"/><path d="M8 14v6"/><path d="M16 14v6"/></svg>` }, { id: 'cigarettes', name: 'Cigarettes', allocated: 4500, spent: 0, type: 'Wants', color: '#3B82F6', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Z"/><path d="M2 12h2"/><path d="M20 12h2"/></svg>` }, { id: 'gifts', name: 'Gifts', allocated: 1000, spent: 0, type: 'Wants', color: '#6366F1', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" x2="12" y1="22" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>` }, { id: 'sweetTooth', name: 'Sweet Tooth', allocated: 500, spent: 0, type: 'Wants', color: '#8B5CF6', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a2.4 2.4 0 0 0-2.4 2.4c0 1.6.8 2.4 1.6 3.2.7.7 1.2 1.2 1.2 2.2v1.2c0 .4-.2.8-.4 1-.2.3-.5.5-.8.6-.7.3-1.4.2-2.1-.2-1.1-.6-2.4-1.6-3.6-2.5C4.3 9.3 3.3 8.5 2.5 7.7.8 6.1 2 3.8 3.4 2.8 4.9 1.8 7 2.4 7.8 3c.8.7 1.5 1.8 2.2 2.8.3.4.7.8 1.1 1.2.2.2.4.3.6.4.2.1.4.1.6 0 .2-.1.4-.2.6-.4.4-.4.8-.8 1.1-1.2.8-1 1.5-2.1 2.2-2.8.8-.7 2.9-1.2 4.4-0.2s2.6 3.3 1.7 4.9c-.8.8-1.8 1.6-2.9 2.4-1.2.9-2.5 1.9-3.6 2.5-1.4.8-2.9.8-4.3.2-1.4-.6-2.5-1.8-2.7-3.3v-1.2c0-1-.4-1.5-1.2-2.2-.8-.8-1.6-1.6-1.6-3.2A2.4 2.4 0 0 0 12 2z"/><path d="M12 12.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/></svg>` }, { id: 'subscriptions', name: 'Subscriptions', allocated: 390, spent: 0, type: 'Wants', color: '#EC4899', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>` }, { id: 'diningOut', name: 'Dining Out', allocated: 1500, spent: 0, type: 'Wants', color: '#F43F5E', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3z"/></svg>` }, { id: 'miscWants', name: 'Miscellaneous Wants', allocated: 2260, spent: 0, type: 'Wants', color: '#64748B', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>` }, { id: 'savings', name: 'Savings', allocated: 4000, spent: 0, type: 'Savings', color: '#A855F7', icon: `<svg class="category-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M8 12h7"/><path d="M12 7v10"/></svg>` }, ],
        transactions: []
    };
    const categoryMapping = { "groceries": ["groceries", "grocery", "بقالة", "سوبر ماركت"], "utilities": ["utilities", "bills", "فواتير", "كهرباء", "غاز"], "homeOwnership": ["home", "rent", "ايجار", "صيانة"], "fuel": ["fuel", "gas", "بنزين"], "healthcare": ["health", "pharmacy", "doctor", "صيدلية", "دكتور"], "dogEssentials": ["dog", "pet", "كلب"], "cigarettes": ["cigarettes", "smoke", "سجائر"], "gifts": ["gifts", "presents", "هدايا"], "sweetTooth": ["sweets", "dessert", "حلويات"], "subscriptions": ["subscriptions", "netflix", "spotify", "اشتراك"], "diningOut": ["dining", "restaurant", "مطعم", "اكل بره"], "miscWants": ["misc", "miscellaneous", "shopping", "entertainment", "متفرقات", "شوبينج"], "savings": ["savings", "توفير", "ادخار"] };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    const observer = new IntersectionObserver((entries) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }); }, { threshold: 0.1 });

    function showNotification(message, type = 'info', duration = 3000) { const el = document.getElementById('inlineNotification'); el.textContent = message; el.className = 'hidden'; void el.offsetWidth; el.classList.add(type, 'show'); setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.classList.add('hidden'), 300); }, duration); }
    function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
    function hideModal(id) { document.getElementById(id).classList.add('hidden'); }
    async function showConfirmModal(title, message) { const modalId = CONSTANTS.MODAL_IDS.confirm; const modal = document.getElementById(modalId); modal.innerHTML = `<div class="custom-modal-content"><h2 class="custom-modal-title">${title}</h2><p class="text-center text-gray-600 mb-6">${message}</p><div class="custom-modal-buttons justify-center"><button class="custom-modal-button custom-modal-cancel">Cancel</button><button class="custom-modal-button custom-modal-confirm">Confirm</button></div></div>`; showModal(modalId); return new Promise(resolve => { modal.querySelector('.custom-modal-confirm').onclick = () => { hideModal(modalId); resolve(true); }; modal.querySelector('.custom-modal-cancel').onclick = () => { hideModal(modalId); resolve(false); }; }); }

    function initializeDOMCache() {
        dom.loadingSpinner = document.getElementById('loadingSpinner');
        dom.mainContent = document.getElementById('mainContent');
        dom.userIdDisplay = document.getElementById('userIdDisplay');
        dom.userIdValue = document.getElementById('userIdValue');
        dom.voiceFab = document.getElementById('voiceFab');
        dom.tabs = document.querySelectorAll('.tab-button');
        dom.tabPanels = document.querySelectorAll('.tab-panel');
        dom.budgetControlPanel = document.getElementById('budgetControlPanel');
        dom.budgetSelector = document.getElementById('budgetSelector');
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
                showNotification("Critical Error: Could not connect to the service. Please refresh.", "danger", 10000);
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
                showNotification("Updating account to support multiple budgets...", "info");
                const oldBudgetData = oldBudgetSnap.data();
                oldBudgetData.name = "Default Budget";
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

    async function saveBudget() { if (!isAuthReady || !userId || !currentBudget || !activeBudgetId) return; lastAddedTransactionId = null; const budgetDocRef = doc(db, `artifacts/${appId}/users/${userId}/budgets/${activeBudgetId}`); try { await setDoc(budgetDocRef, currentBudget, { merge: true }); } catch (error) { console.error("Error saving budget:", error); showNotification("Error: Could not save changes.", "danger"); } }
    function populateBudgetSelector() { dom.budgetSelector.innerHTML = ''; for (const id in allBudgets) { const option = document.createElement('option'); option.value = id; option.textContent = allBudgets[id]; dom.budgetSelector.appendChild(option); } if (activeBudgetId) { dom.budgetSelector.value = activeBudgetId; } document.getElementById('deleteBudgetButton').disabled = Object.keys(allBudgets).length <= 1; }
    async function setActiveBudgetId(budgetId) { activeBudgetId = budgetId; const prefsDocRef = doc(db, `artifacts/${appId}/users/${userId}/preferences/userPrefs`); try { await setDoc(prefsDocRef, { activeBudgetId: budgetId }); } catch (error) { console.error("Could not save preference:", error); } }
    async function handleBudgetSwitch() { const newBudgetId = dom.budgetSelector.value; if (newBudgetId === activeBudgetId) return; dom.mainContent.classList.add('hidden'); dom.loadingSpinner.classList.remove('hidden'); await setActiveBudgetId(newBudgetId); await setupBudgetListener(newBudgetId); }
    async function createNewBudget(name) { const newBudgetData = JSON.parse(JSON.stringify(defaultBudget)); newBudgetData.name = name; const budgetsColRef = collection(db, `artifacts/${appId}/users/${userId}/budgets`); try { const docRef = await addDoc(budgetsColRef, newBudgetData); allBudgets[docRef.id] = name; populateBudgetSelector(); showNotification(`Budget "${name}" created.`, 'success'); return docRef.id; } catch (error) { console.error("Error creating budget:", error); showNotification("Could not create budget.", "danger"); return null; } }
    async function deleteCurrentBudget() { if (Object.keys(allBudgets).length <= 1) { showNotification("Cannot delete your only budget.", "danger"); return; } const budgetNameToDelete = allBudgets[activeBudgetId]; const confirmed = await showConfirmModal(`Delete "${budgetNameToDelete}"?`, "This is permanent and will delete all data for this budget."); if (confirmed) { const budgetToDelRef = doc(db, `artifacts/${appId}/users/${userId}/budgets/${activeBudgetId}`); const idToDelete = activeBudgetId; delete allBudgets[idToDelete]; const newActiveId = Object.keys(allBudgets)[0]; try { await deleteDoc(budgetToDelRef); showNotification(`Budget "${budgetNameToDelete}" deleted.`, "success"); dom.budgetSelector.value = newActiveId; await handleBudgetSwitch(); populateBudgetSelector(); } catch (error) { console.error("Error deleting budget:", error); showNotification("Failed to delete budget.", "danger"); allBudgets[idToDelete] = budgetNameToDelete; } } }
    
    function renderUI() { if (!currentBudget) return; renderSummary(); renderCategories(); populateTransactionFilters(); renderTransactionList(); renderHistoryList(); renderInsights(); }
    
    // All other rendering functions follow...
    // (This includes the full implementations of all functions)
    
    // PASTE ALL OTHER FUNCTIONS HERE
    
    // --- Initialize Event Listeners ---
    function initializeEventListeners() {
        dom.tabs.forEach(button => button.addEventListener('click', () => { const tab = button.dataset.tab; dom.tabs.forEach(btn => btn.classList.remove('active')); button.classList.add('active'); dom.tabPanels.forEach(panel => panel.classList.toggle('active', panel.id === `tab-${tab}`)); }));
        dom.budgetSelector.addEventListener('change', handleBudgetSwitch);
        document.getElementById('addBudgetButton').addEventListener('click', async () => { const name = prompt("Enter a name for the new budget:", "New Budget"); if (name) { const newId = await createNewBudget(name); if (newId) { dom.budgetSelector.value = newId; await handleBudgetSwitch(); } } });
        document.getElementById('deleteBudgetButton').addEventListener('click', deleteCurrentBudget);
        document.getElementById('editIncomeButton').onclick = async () => { const newIncomeStr = prompt("Enter new monthly income:", currentBudget.income); if (newIncomeStr !== null) { const newIncome = parseFloat(newIncomeStr); if (!isNaN(newIncome) && newIncome >= 0) { currentBudget.income = newIncome; await saveBudget(); showNotification("Income updated successfully!", "success"); } else { showNotification("Invalid input. Please enter a valid number.", "danger"); } } };
        document.getElementById('addCategoryModalButton').onclick = () => openCategoryModal();
        document.getElementById('addExpenseFab').onclick = () => openTransactionModal();
        dom.voiceFab.onclick = () => { if (recognition) { try { recognition.start(); } catch (e) { console.error("Could not start recognition:", e); } }};
        document.getElementById('archiveMonthButton').onclick = async () => { const confirmed = await showConfirmModal('Archive Month?', 'This will save a snapshot and reset spending for the new month.'); if (confirmed) { const now = new Date(); const archiveId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; const archiveDocRef = doc(db, `artifacts/${appId}/users/${userId}/budgets/${activeBudgetId}/archive/${archiveId}`); try { await setDoc(archiveDocRef, currentBudget); currentBudget.transactions = []; currentBudget.categories.forEach(c => c.spent = 0); await saveBudget(); showNotification(`Budget for ${archiveId} has been archived.`, 'success'); } catch (error) { console.error("Error archiving month:", error); showNotification("Archiving failed.", "danger"); } } };
        document.getElementById('manageTypesButton').onclick = () => openManagementModal({ modalId: CONSTANTS.MODAL_IDS.manageItems, title: "Manage Category Types", itemsKey: "types", placeholder: "New Type Name", onAdd: async (name) => { if(!currentBudget.types) currentBudget.types = []; currentBudget.types.push(name); await saveBudget(); }, onDelete: async (name) => { const categoriesUsingType = currentBudget.categories.filter(c => c.type === name); const confirmed = await showConfirmModal('Delete Type?', `This will also delete ${categoriesUsingType.length} associated categories and all their transactions.`); if (confirmed) { currentBudget.types = currentBudget.types.filter(t => t !== name); const categoryIdsToDelete = categoriesUsingType.map(c => c.id); currentBudget.categories = currentBudget.categories.filter(c => c.type !== name); currentBudget.transactions = currentBudget.transactions.filter(t => !categoryIdsToDelete.includes(t.categoryId)); await saveBudget(); } return confirmed; } });
        document.getElementById('managePaymentsButton').onclick = () => openManagementModal({ modalId: CONSTANTS.MODAL_IDS.manageItems, title: "Manage Payment Methods", itemsKey: "paymentMethods", placeholder: "New Payment Method", onAdd: async (name) => { if(!currentBudget.paymentMethods) currentBudget.paymentMethods = []; currentBudget.paymentMethods.push(name); await saveBudget(); }, onDelete: async (name) => { const confirmed = await showConfirmModal('Delete Payment Method?', `This will not affect existing transactions.`); if (confirmed) { currentBudget.paymentMethods = currentBudget.paymentMethods.filter(pm => pm !== name); await saveBudget(); } return confirmed; } });
        document.getElementById('manageSubcategoriesButton').onclick = () => { const modalId = CONSTANTS.MODAL_IDS.manageSubcategories; const modal = document.getElementById(modalId); const renderSubcategories = () => { const subcategoriesList = Object.keys(currentBudget.subcategories || {}).sort().map(sub => `<li class="bg-gray-100 p-3 rounded-md"><div class="flex justify-between items-center mb-2"><span class="font-semibold">${sub}</span><button data-sub-name="${sub}" class="delete-sub-btn p-1 text-gray-400 hover:text-red-600"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></div><div class="grid grid-cols-2 gap-2 text-sm">${(currentBudget.categories || []).map(cat => `<div><input type="checkbox" id="sub-${sub}-${cat.id}" data-sub-name="${sub}" data-cat-id="${cat.id}" class="mr-2" ${(currentBudget.subcategories[sub] || []).includes(cat.id) ? 'checked' : ''}><label for="sub-${sub}-${cat.id}">${cat.name}</label></div>`).join('')}</div></li>`).join(''); modal.innerHTML = `<div class="custom-modal-content"><h2 class="custom-modal-title">Manage Subcategories</h2><ul class="space-y-4 mb-4 max-h-60 overflow-y-auto">${subcategoriesList}</ul><form id="addSubcategoryForm" class="flex gap-2"><input type="text" id="newSubcategoryName" class="form-input" placeholder="New Subcategory Name" required /><button type="submit" class="btn btn-purple">Add</button></form><div class="custom-modal-buttons justify-center"><button type="button" class="custom-modal-button custom-modal-cancel">Close</button></div></div>`; modal.querySelector('#addSubcategoryForm').onsubmit = async (e) => { e.preventDefault(); const newNameInput = document.getElementById('newSubcategoryName'); const newName = newNameInput.value.trim(); if (newName && !(currentBudget.subcategories || {})[newName]) { if (!currentBudget.subcategories) currentBudget.subcategories = {}; currentBudget.subcategories[newName] = []; await saveBudget(); renderSubcategories(); } newNameInput.value = ''; }; modal.querySelectorAll('input[type="checkbox"]').forEach(checkbox => { checkbox.onchange = async (e) => { const subName = e.target.dataset.subName; const catId = e.target.dataset.catId; if (e.target.checked) { if (!((currentBudget.subcategories[subName] || []).includes(catId))) { currentBudget.subcategories[subName].push(catId); } } else { currentBudget.subcategories[subName] = (currentBudget.subcategories[subName] || []).filter(id => id !== catId); } await saveBudget(); }; }); modal.querySelectorAll('.delete-sub-btn').forEach(btn => { btn.onclick = async (e) => { const subName = e.currentTarget.dataset.subName; const confirmed = await showConfirmModal('Delete Subcategory?', `This will remove it from all transactions and categories.`); if (confirmed) { delete currentBudget.subcategories[subName]; (currentBudget.transactions || []).forEach(t => { if (t.subcategory === subName) t.subcategory = ''; }); await saveBudget(); renderSubcategories(); } }; }); modal.querySelector('.custom-modal-cancel').onclick = () => hideModal(modalId); }; renderSubcategories(); showModal(modalId); };
        document.getElementById('filterCategory').addEventListener('change', renderTransactionList);
        document.getElementById('filterPaymentMethod').addEventListener('change', renderTransactionList);
        document.getElementById('filterStartDate').addEventListener('change', renderTransactionList);
        document.getElementById('filterEndDate').addEventListener('change', renderTransactionList);
        document.getElementById('clearFiltersButton').onclick = () => { document.getElementById('filterCategory').value = 'all'; document.getElementById('filterPaymentMethod').value = 'all'; document.getElementById('filterStartDate').value = ''; document.getElementById('filterEndDate').value = ''; renderTransactionList(); };
        document.getElementById('transactionPieChartGroup').addEventListener('change', renderTransactionList);
        document.getElementById('transactionList').addEventListener('click', (e) => { const editBtn = e.target.closest('.edit-transaction-btn'); if (editBtn) { const transactionId = editBtn.dataset.editId; const transaction = (currentBudget.transactions || []).find(t => t.id === transactionId); if(transaction) openTransactionModal(transaction); } const deleteBtn = e.target.closest('.delete-transaction-btn'); if(deleteBtn) { handleDeleteTransaction(deleteBtn.dataset.deleteId); } });
        document.getElementById('monthlyHistoryList').addEventListener('click', async (e) => { const viewBtn = e.target.closest('.view-archive-btn'); if (viewBtn) { const archiveId = viewBtn.dataset.archiveId; const archiveDocRef = doc(db, `artifacts/${appId}/users/${userId}/budgets/${activeBudgetId}/archive/${archiveId}`); try { const docSnap = await getDoc(archiveDocRef); if (docSnap.exists()) { renderArchivedMonthDetails(archiveId, docSnap.data()); showModal(CONSTANTS.MODAL_IDS.archivedDetails); } else { showNotification("Could not find archive.", "danger"); } } catch (error) { console.error("Error fetching archive details:", error); showNotification("Failed to load archive details.", "danger"); } } });
    }
});
