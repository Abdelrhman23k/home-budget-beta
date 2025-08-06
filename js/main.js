import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from './config.js';
import { initializeAppLogic } from './app.js';

/**
 * This is the single entry point for the entire application.
 * It waits for the browser to confirm the HTML page is fully loaded before doing anything.
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // 2. Start the authentication process
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // 3. Once a user is authenticated, initialize the main application logic
            initializeAppLogic(user, db);
        } else {
            // 4. If no user, attempt to sign in anonymously
            try {
                const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken);
                else await signInAnonymously(auth);
            } catch (error) {
                console.error("Critical Authentication Error:", error);
                document.body.innerHTML = `<div class="error-screen">Could not connect to the service. Please refresh the page.</div>`;
            }
        }
    });
});
