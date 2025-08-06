import * as firestore from './firestore.js';
import * as ui from './ui.js';
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
        ui.initializeEventListeners();
        
        // 4. Connect the state store to the UI renderer.
        state.store.subscribe(ui.renderUI);

        // 5. Start the main data loading process from Firestore.
        await firestore.initializeAppState(user.uid, db);
        
        // 6. Initialize the speech recognition feature.
        setupSpeechRecognition();

    } catch (error) {
        console.error("Critical error during app initialization:", error);
        ui.setUIState('error', { message: "Could not load your budget. Please check your internet connection and refresh the page." });
    }
}
