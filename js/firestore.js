import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './firebase.js';
import { defaultBudget, appId } from './config.js';
import { store, setAllBudgets, updateAllBudgets, setCurrentBudget, setUnsubscribe, setActiveBudgetId as setStateActiveBudgetId } from './state.js';
import { showNotification, populateBudgetSelector } from './ui/core.js';
import { logError } from './utils.js';

// --- DATA READ/WRITE FUNCTIONS ---

export async function saveBudget(userId, budgetId, budgetData) {
    if (!userId || !budgetId || !budgetData) return;
    const budgetDocRef = doc(db, `artifacts/${appId}/users/${userId}/budgets/${budgetId}`);
    try {
        await setDoc(budgetDocRef, budgetData, { merge: true });
    } catch (error) {
        logError('firestore.saveBudget', error);
        showNotification("Error saving your changes. Please check your connection.", "danger");
        throw error; // Re-throw the error for the caller to handle if needed
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
        logError('firestore.createNewBudget', error);
        showNotification("Could not create new budget.", "danger");
        throw error;
    }
}

export async function deleteBudget(userId, budgetId) {
    const budgetToDelRef = doc(db, `artifacts/${appId}/users/${userId}/budgets/${budgetId}`);
    try {
        await deleteDoc(budgetToDelRef);
    } catch (error) {
        logError('firestore.deleteBudget', error);
        showNotification("Failed to delete budget.", "danger");
        throw error;
    }
}

export async function saveActiveBudgetId(userId, budgetId) {
    const prefsDocRef = doc(db, `artifacts/${appId}/users/${userId}/preferences/userPrefs`);
    try {
        await setDoc(prefsDocRef, { activeBudgetId: budgetId });
    } catch (error) {
        logError('firestore.saveActiveBudgetId', error);
        // This is a non-critical error, so we don't show a notification
    }
}

export async function getArchivedBudgets(userId, budgetId) {
    const archiveColRef = collection(db, `artifacts/${appId}/users/${userId}/budgets/${budgetId}/archive`);
    try {
        return await getDocs(archiveColRef);
    } catch (error) {
        logError('firestore.getArchivedBudgets', error);
        showNotification("Could not load budget history.", "danger");
        return { empty: true, docs: [] }; // Return an empty snapshot-like object
    }
}

// --- APP INITIALIZATION LOGIC ---

export async function initializeAppState(userId, db) {
    await migrateOldBudgetStructure(userId, db);
    const budgetsColRef = collection(db, `artifacts/${appId}/users/${userId}/budgets`);
    const budgetsSnapshot = await getDocs(budgetsColRef);
    
    let budgets = {};
    budgetsSnapshot.forEach(doc => { budgets[doc.id] = doc.data().name || "Untitled Budget"; });
    setAllBudgets(budgets);

    let budgetIdToLoad;
    if (Object.keys(budgets).length === 0) {
        const newBudget = await createNewBudget(userId, "My First Budget");
        if (newBudget) {
            budgetIdToLoad = newBudget.id;
            updateAllBudgets(newBudget.id, newBudget.name);
        } else {
            throw new Error("Failed to create the first budget for a new user.");
        }
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
    populateBudgetSelector();
    await setupBudgetListener(userId, budgetIdToLoad, db);
}

async function migrateOldBudgetStructure(userId, db) {
    const oldBudgetRef = doc(db, `artifacts/${appId}/users/${userId}/budget/current`);
    const budgetsColRef = collection(db, `artifacts/${appId}/users/${userId}/budgets`);
    try {
        const oldBudgetSnap = await getDoc(oldBudgetRef);
        const budgetsSnapshot = await getDocs(budgetsColRef);
        if (oldBudgetSnap.exists() && budgetsSnapshot.empty) {
            showNotification("Updating account...", "info");
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
        logError('firestore.migrateOldBudgetStructure', error);
        showNotification("Could not update account structure.", "danger");
        throw error; // Propagate the error to stop initialization if migration fails
    }
}

export function setupBudgetListener(userId, budgetId, db) {
    const budgetDocRef = doc(db, `artifacts/${appId}/users/${userId}/budgets/${budgetId}`);
    return new Promise((resolve, reject) => {
        const unsubscribe = onSnapshot(budgetDocRef, (docSnap) => {
            try {
                if (docSnap.exists()) {
                    setCurrentBudget(docSnap.data());
                    resolve();
                } else {
                    reject(new Error(`Budget with ID ${budgetId} not found.`));
                }
            } catch(error) {
                logError('firestore.setupBudgetListener_callback', error);
                reject(error);
            }
        }, (error) => {
            logError('firestore.setupBudgetListener_snapshotError', error);
            showNotification("Connection to data lost. Please refresh.", "danger");
            reject(error);
        });
        setUnsubscribe(unsubscribe);
    });
}
