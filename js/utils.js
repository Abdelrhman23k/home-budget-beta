/**
 * Formats an ISO date string into a more readable format.
 * @param {string} isoString - The date string to format.
 * @returns {string} The formatted date.
 */
export function formatTimestamp(isoString) {
    if (!isoString) return 'Invalid Date';
    // Handles both 'YYYY-MM-DD' and full ISO strings
    const date = new Date(isoString);
    const options = { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }; // Use UTC to avoid timezone issues with YYYY-MM-DD
    return date.toLocaleDateString('en-US', options);
}

/**
 * Logs errors with a consistent format and additional context.
 * @param {string} context - The name of the function or area where the error occurred.
 * @param {Error} error - The original error object.
 */
export function logError(context, error) {
    console.error(`[ERROR in ${context}]: ${error.message}`, {
        originalError: error,
        timestamp: new Date().toISOString()
    });
}
