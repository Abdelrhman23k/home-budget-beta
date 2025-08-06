import { initializeAuth } from './auth.js';
import { initializeAppState } from './firestore.js';
import { initializeDOMCache, initializeEventListeners, setUIState, showNotification } from './ui.js';
import { setupSpeechRecognition } from './speech.js';
import { store, setUserId } from './state.js';

document.addEventListener('DOMContentLoaded', () => {
    store.subscribe(() => setUIState('loaded'));
    initializeAuth(onUserAuthenticated);
});

async function onUserAuthenticated(user) {
    try {
        initializeDOMCache();
        setUserId(user.uid);
        initializeEventListeners();
        await initializeAppState();
        setupSpeechRecognition();
    } catch (error) {
        console.error("Critical error during app initialization:", error);
        setUIState('error', { message: "A critical error occurred while loading your budget. Please refresh the page." });
    }
}
