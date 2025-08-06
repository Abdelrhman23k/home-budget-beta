import { store, setLastAddedItemId } from './state.js';
import { saveBudget } from './firestore.js';
import { showNotification } from './ui.js';
import { categoryMapping } from './config.js';
import { logError } from './utils.js';

let recognition = null;

export function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        if(document.getElementById('voiceFab')) document.getElementById('voiceFab').disabled = true;
        return;
    }
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => { document.getElementById('voiceFab')?.classList.add('listening'); showNotification("Listening...", "info"); };
    recognition.onend = () => { document.getElementById('voiceFab')?.classList.remove('listening'); };
    recognition.onerror = (event) => {
        logError('speech.onerror', event.error);
        let message = `Speech error: ${event.error}`;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') message = "Microphone permission denied.";
        else if (event.error === 'no-speech') message = "No speech was detected.";
        showNotification(message, "danger");
    };
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        processVoiceCommand(transcript);
    };
}

export function startRecognition() {
    if (recognition) {
        try { recognition.start(); }
        catch (e) { logError("speech.startRecognition", e); }
    }
}

async function processVoiceCommand(transcript) {
    try {
        const numbers = transcript.match(/(\d+(\.\d+)?)/);
        if (!numbers) { showNotification("Could not detect an amount.", "danger"); return; }
        const amount = parseFloat(numbers[0]);

        let foundCategoryId = null;
        for (const categoryId in categoryMapping) {
            if (categoryMapping[categoryId].some(keyword => transcript.includes(keyword))) {
                foundCategoryId = categoryId;
                break;
            }
        }

        if (!foundCategoryId) { showNotification(`Could not detect a category for: "${transcript}"`, "danger"); return; }

        const newTransactionId = `trans-${Date.now()}`;
        const newTransaction = {
            id: newTransactionId, amount, categoryId: foundCategoryId,
            description: `Voice entry: "${transcript}"`, date: new Date().toISOString(),
            paymentMethod: 'Cash', subcategory: ''
        };

        setLastAddedItemId(newTransactionId);
        if (!store.currentBudget.transactions) store.currentBudget.transactions = [];
        store.currentBudget.transactions.push(newTransaction);
        
        store.recalculateSpentAmounts();
        await saveBudget(store.userId, store.activeBudgetId, store.currentBudget);
        
        const categoryName = store.currentBudget.categories.find(c => c.id === foundCategoryId)?.name || 'category';
        showNotification(`Added ${amount.toFixed(2)} EGP to ${categoryName}.`, "success");
    } catch (error) {
        logError('speech.processVoiceCommand', error);
        showNotification("Failed to process voice command.", "danger");
    }
}
