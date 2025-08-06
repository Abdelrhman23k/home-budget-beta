import { initializeAuth } from './auth.js';
import { initializeAppState } from './firestore.js';
import { initializeDOMCache, initializeEventListeners, setUIState } from './ui.js';
import { setupSpeechRecognition } from './speech.js';
import { store, setUserId } from './state.js';

document.addEventListener('DOMContentLoaded', () => {
    // Connect the central state to the UI renderer. Any state change
    // will now automatically trigger the UI to show the 'loaded' state.
    store.subscribe(() => setUIState('loaded'));
    
    initializeAuth(onUserAuthenticated);
});

async function onUserAuthenticated(user) {
    try {
        // This sequence is now wrapped in a robust error handler.
        initializeDOMCache();
        setUserId(user.uid);
        initializeEventListeners();
        await initializeAppState();
        setupSpeechRecognition();
    } catch (error) {
        console.error("Critical error during app initialization:", error);
        setUIState('error', { message: "Could not load your budget. Please check your internet connection and refresh the page." });
    }
}
