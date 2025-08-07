import * as firestore from './firestore.js';
import * as ui from './ui/core.js';
import * as dashboardUI from './ui/dashboard.js';
import * as transactionsUI from './ui/transactions.js';
import * as historyUI from './ui/history.js';
import * as insightsUI from './ui/insights.js';
import { initializeEventListeners } from './ui/events.js';
import * as state from './state.js';
import { setupSpeechRecognition } from './speech.js';

/**
 * Initializes the entire application after authentication is successful.
 * This function orchestrates the setup of all modules.
 * @param {object} user - The authenticated Firebase user.
 * @param {object} db - The Firestore database instance.
 */
export async function initializeAppLogic(user, db) {
    try {
        // 1. Initialize and cache all necessary DOM elements.
        ui.initializeDOMCache();
        
        // 2. Set the global user ID and update the UI with it.
        state.setUserId(user.uid);
        ui.renderUserId(user.uid);
        
        // 3. Make all static buttons and elements interactive.
        initializeEventListeners();
        
        // 4. Connect the state store to the UI renderer.
        // When state changes, this will call the correct render functions.
        state.store.subscribe(() => {
            dashboardUI.renderDashboard();
            transactionsUI.renderTransactionsPage();
            historyUI.renderHistoryPage();
            insightsUI.renderInsightsPage();
        });

        // 5. Start the main data loading process from Firestore.
        await firestore.initializeAppState(user.uid, db);
        
        // 6. Initialize the speech recognition feature.
        setupSpeechRecognition();

    } catch (error) {
        console.error("Critical error during app initialization:", error);
        ui.setUIState('error', { message: "Could not load your budget. Please check your internet connection and refresh the page." });
    }
}
