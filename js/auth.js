import { signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { auth } from './firebase.js';
import { showNotification } from './ui.js';

/**
 * Initializes the authentication process and listens for user state changes.
 * @param {function} onAuthenticated - The callback function to execute when a user is successfully authenticated.
 */
export function initializeAuth(onAuthenticated) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in, proceed with the app logic.
            onAuthenticated(user);
        } else {
            // User is signed out, attempt to sign them in anonymously.
            try {
                const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Authentication failed:", error);
                showNotification("Critical Error: Could not connect. Please refresh.", "danger", 10000);
            }
        }
    });
}
