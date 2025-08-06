/**
 * Formats an ISO date string into a more readable format.
 * @param {string} isoString - The date string to format.
 * @returns {string} The formatted date.
 */
export function formatTimestamp(isoString) {
    if (!isoString) return 'Invalid Date';
    // Check if it's already just a date (YYYY-MM-DD)
    if (isoString.length === 10) {
        const [year, month, day] = isoString.split('-');
        const date = new Date(year, month - 1, day);
        const options = { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
        return date.toLocaleDateString('en-US', options);
    }
    // Handle full datetime strings
    const date = new Date(isoString);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}
