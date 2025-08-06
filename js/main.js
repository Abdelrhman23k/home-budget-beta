import { initializeAuth } from './auth.js';
import { initializeAppState } from './firestore.js';
import { initializeDOMCache, initializeEventListeners, renderUI } from './ui.js';
import { setupSpeechRecognition } from './speech.js';
import { store, setUserId } from './state.js';

// This is the main entry point of the entire application.
document.addEventListener('DOMContentLoaded', () => {
    // Connect the central state to the UI renderer. From now on, any
    // change to the state will automatically trigger a re-render of the UI.
    store.subscribe(renderUI);

    initializeAuth(onUserAuthenticated);
});

/**
 * This callback is executed by auth.js once Firebase confirms a user is logged in.
 * It kicks off the rest of the application setup.
 * @param {object} user - The Firebase user object.
 */
async function onUserAuthenticated(user) {
    try {
        // 1. Find all necessary DOM elements and cache them.
        initializeDOMCache();

        // 2. Set the global user ID. This will trigger the first UI render for the user ID.
        setUserId(user.uid);
        
        // 3. Make all static buttons and elements interactive.
        initializeEventListeners();
        
        // 4. Start the main data loading and budget setup process from Firestore.
        await initializeAppState();
        
        // 5. Initialize the speech recognition feature.
        setupSpeechRecognition();
    } catch (error) {
        console.error("Critical error during app initialization:", error);
        showNotification("A critical error occurred. Please refresh the page.", "danger", 10000);
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) spinner.classList.add('hidden');
    }
}
