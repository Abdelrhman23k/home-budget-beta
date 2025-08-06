import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './firebase.js';
import { defaultBudget, appId } from './config.js';
import { store, setAllBudgets, updateAllBudgets, setCurrentBudget, setUnsubscribe } from './state.js';
import { showNotification, populateBudgetSelector } from './ui.js';

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

export async function getArchivedBudgets(userId, budgetId) {
    const archiveColRef = collection(db, `artifacts/${appId}/users/${userId}/budgets/${budgetId}/archive`);
    return await getDocs(archiveColRef);
}

export async function initializeAppState() {
    try {
        await migrateOldBudgetStructure(store.userId);
        const budgetsColRef = collection(db, `artifacts/${appId}/users/${store.userId}/budgets`);
        const budgetsSnapshot = await getDocs(budgetsColRef);
        
        let budgets = {};
        budgetsSnapshot.forEach(doc => { budgets[doc.id] = doc.data().name || "Untitled Budget"; });
        setAllBudgets(budgets);

        let budgetIdToLoad;
        if (Object.keys(budgets).length === 0) {
            const newBudget = await createNewBudget(store.userId, "My First Budget");
            if (newBudget) {
                budgetIdToLoad = newBudget.id;
                updateAllBudgets(newBudget.id, newBudget.name);
            }
        } else {
            const prefsDocRef = doc(db, `artifacts/${appId}/users/${store.userId}/preferences/userPrefs`);
            const prefsDoc = await getDoc(prefsDocRef);
            if (prefsDoc.exists() && budgets[prefsDoc.data().activeBudgetId]) {
                budgetIdToLoad = prefsDoc.data().activeBudgetId;
            } else {
                budgetIdToLoad = Object.keys(budgets)[0];
            }
        }
        
        store.setActiveBudgetId(budgetIdToLoad);
        populateBudgetSelector();
        await setupBudgetListener(store.userId, budgetIdToLoad);
        
    } catch (error) {
        console.error("Failed to initialize app state:", error);
        throw error; // Re-throw to be caught by the main initializer
    }
}

async function migrateOldBudgetStructure(userId) {
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
        console.error("Migration failed: ", error);
        showNotification("Could not update account structure.", "danger");
    }
}

export function setupBudgetListener(userId, budgetId) {
    const budgetDocRef = doc(db, `artifacts/${appId}/users/${userId}/budgets/${budgetId}`);
    return new Promise((resolve, reject) => {
        const unsubscribe = onSnapshot(budgetDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const budgetData = docSnap.data();
                // Instead of rendering here, we just update the central state.
                // The state's subscriber (renderUI) will handle the rest.
                setCurrentBudget(budgetData);
                resolve();
            } else {
                reject(new Error(`Budget with ID ${budgetId} not found.`));
            }
        }, (error) => {
            console.error(`Error listening to budget ${budgetId}:`, error);
            reject(error);
        });
        setUnsubscribe(unsubscribe);
    });
}
