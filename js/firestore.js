import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './firebase.js';
import { defaultBudget, appId } from './config.js';
import { setAllBudgets, setActiveBudgetId as setStateActiveBudgetId, setUnsubscribe, setCurrentBudget } from './state.js';
import { showNotification, renderUI } from './ui.js';

// --- DATA READ/WRITE FUNCTIONS ---

export async function saveBudget(userId, budgetId, budgetData) {
    if (!userId || !budgetId || !budgetData) return;
    const budgetDocRef = doc(db, `artifacts/${appId}/users/${userId}/budgets/${budgetId}`);
    try {
        await setDoc(budgetDocRef, budgetData, { merge: true });
    } catch (error) {
        console.error("Error saving budget:", error);
        showNotification("Error: Could not save changes.", "danger");
    }
}

export async function createNewBudget(userId, name) {
    const newBudgetData = JSON.parse(JSON.stringify(defaultBudget));
    newBudgetData.name = name;
    const budgetsColRef = collection(db, `artifacts/${appId}/users/${userId}/budgets`);
    try {
        const docRef = await addDoc(budgetsColRef, newBudgetData);
        return { id: docRef.id, name: name };
    } catch (error) {
        console.error("Error creating new budget:", error);
        showNotification("Could not create new budget.", "danger");
        return null;
    }
}

export async function deleteBudget(userId, budgetId) {
    const budgetToDelRef = doc(db, `artifacts/${appId}/users/${userId}/budgets/${budgetId}`);
    await deleteDoc(budgetToDelRef);
}

export async function saveActiveBudgetId(userId, budgetId) {
    const prefsDocRef = doc(db, `artifacts/${appId}/users/${userId}/preferences/userPrefs`);
    try {
        await setDoc(prefsDocRef, { activeBudgetId: budgetId });
    } catch (error) {
        console.error("Could not save user preference:", error);
    }
}

// --- APP INITIALIZATION LOGIC ---

export async function initializeAppState(userId) {
    const dom = {
        mainContent: document.getElementById('mainContent'),
        budgetControlPanel: document.getElementById('budgetControlPanel'),
        loadingSpinner: document.getElementById('loadingSpinner')
    };
    
    dom.mainContent.classList.add('hidden');
    dom.budgetControlPanel.classList.add('hidden');
    dom.loadingSpinner.classList.remove('hidden');

    try {
        await migrateOldBudgetStructure(userId);
        const budgetsColRef = collection(db, `artifacts/${appId}/users/${userId}/budgets`);
        const budgetsSnapshot = await getDocs(budgetsColRef);
        
        let budgets = {};
        budgetsSnapshot.forEach(doc => { budgets[doc.id] = doc.data().name || "Untitled Budget"; });
        setAllBudgets(budgets);

        let budgetIdToLoad;
        if (Object.keys(budgets).length === 0) {
            const newBudget = await createNewBudget(userId, "My First Budget");
            budgetIdToLoad = newBudget.id;
            updateAllBudgets(newBudget.id, newBudget.name);
        } else {
            const prefsDocRef = doc(db, `artifacts/${appId}/users/${userId}/preferences/userPrefs`);
            const prefsDoc = await getDoc(prefsDocRef);
            if (prefsDoc.exists() && budgets[prefsDoc.data().activeBudgetId]) {
                budgetIdToLoad = prefsDoc.data().activeBudgetId;
            } else {
                budgetIdToLoad = Object.keys(budgets)[0];
            }
        }
        
        setStateActiveBudgetId(budgetIdToLoad);
        await setupBudgetListener(userId, budgetIdToLoad);
        dom.budgetControlPanel.classList.remove('hidden');

    } catch (error) {
        console.error("Failed to initialize app state:", error);
        showNotification("A critical error occurred while loading. Please refresh.", "danger", 10000);
        dom.loadingSpinner.classList.add('hidden');
    }
}

async function migrateOldBudgetStructure(userId) {
    const oldBudgetRef = doc(db, `artifacts/${appId}/users/${userId}/budget/current`);
    const budgetsColRef = collection(db, `artifacts/${appId}/users/${userId}/budgets`);
    try {
        const oldBudgetSnap = await getDoc(oldBudgetRef);
        const budgetsSnapshot = await getDocs(budgetsColRef);

        if (oldBudgetSnap.exists() && budgetsSnapshot.empty) {
            showNotification("Updating your account...", "info");
            const oldBudgetData = oldBudgetSnap.data();
            oldBudgetData.name = "Default Budget";
            if (oldBudgetData.income && !oldBudgetData.incomeTransactions) {
                oldBudgetData.incomeTransactions = [{ id: 'income-migrated-' + Date.now(), amount: oldBudgetData.income, description: 'Initial Budgeted Income', date: new Date().toISOString().slice(0, 10) }];
            }
            delete oldBudgetData.income;
            if (!oldBudgetData.transactions) oldBudgetData.transactions = [];

            const newBudgetRef = await addDoc(budgetsColRef, oldBudgetData);
            await saveActiveBudgetId(userId, newBudgetRef.id);
            await deleteDoc(oldBudgetRef);
            showNotification("Account update complete!", "success");
        }
    } catch (error) {
        console.error("Migration failed: ", error);
        showNotification("Could not update account structure.", "danger");
    }
}

export function setupBudgetListener(userId, budgetId) {
    const budgetDocRef = doc(db, `artifacts/${appId}/users/${userId}/budgets/${budgetId}`);
    return new Promise((resolve, reject) => {
        const unsubscribe = onSnapshot(budgetDocRef, (docSnap) => {
            try {
                if (docSnap.exists()) {
                    const budgetData = docSnap.data();
                    setCurrentBudget(budgetData);
                    renderUI(); // Render the UI with the new data
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
        setUnsubscribe(unsubscribe);
    });
}

// ... Additional firestore functions for insights, history can be added here
