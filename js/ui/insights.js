import * as state from '../state.js';
import * as firestore from '../firestore.js';
import { logError } from '../utils.js';

/**
 * Main render function for the Insights tab. Called whenever the UI updates.
 */
export function renderInsightsPage() {
    renderNeedsWantsChart();
    renderBudgetHotspots();
    renderHistoricalCharts();
}

/**
 * Renders the "Spending DNA" doughnut chart for the current month.
 */
function renderNeedsWantsChart() {
    const container = document.getElementById('needsWantsChartContainer');
    if (!container) return;

    const categories = state.store.currentBudget.categories || [];
    const totalSpent = categories.reduce((sum, cat) => sum + (cat.spent || 0), 0);

    if (totalSpent === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 mt-8">No spending data for this month yet.</p>`;
        if (state.store.needsWantsChart) state.setNeedsWantsChart(null);
        return;
    }

    const spendingByType = { 'Needs': 0, 'Wants': 0, 'Savings': 0 };
    categories.forEach(cat => {
        if (spendingByType[cat.type] !== undefined) {
            spendingByType[cat.type] += (cat.spent || 0);
        }
    });
    
    container.innerHTML = `<canvas id="needsWantsChartCanvas"></canvas>`;
    const canvas = document.getElementById('needsWantsChartCanvas');
    const ctx = canvas.getContext('2d');

    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(spendingByType),
            datasets: [{
                label: 'Spending',
                data: Object.values(spendingByType),
                backgroundColor: ['#3B82F6', '#F59E0B', '#10B981'],
                borderColor: '#ffffff',
                borderWidth: 4,
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
    state.setNeedsWantsChart(chart);
}

/**
 * Renders the list of top 5 categories nearing their budget limit.
 */
function renderBudgetHotspots() {
    const container = document.getElementById('budgetHotspotsList');
    if (!container) return;

    const categories = (state.store.currentBudget.categories || [])
        .filter(c => (c.allocated || 0) > 0)
        .map(c => ({...c, percentage: ((c.spent || 0) / c.allocated) * 100 }))
        .sort((a,b) => b.percentage - a.percentage)
        .slice(0, 5);

    if (categories.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500">No categories with allocated budgets.</p>`;
        return;
    }

    container.innerHTML = categories.map(cat => {
        const color = cat.percentage > 100 ? 'bg-red-500' : (cat.percentage > 75 ? 'bg-yellow-500' : 'bg-blue-500');
        return `
            <div class="hotspot-item">
                <div class="flex items-center gap-2">
                    <span class="font-semibold text-sm">${cat.name}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs font-mono">${cat.percentage.toFixed(0)}%</span>
                    <div class="progress-bar-container w-24">
                        <div class="progress-bar-fill ${color}" style="width: ${Math.min(100, cat.percentage)}%"></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Renders the two historical charts based on archived data.
 */
async function renderHistoricalCharts() {
    const histContainer = document.getElementById('historicalSavingsChartContainer');
    const deepDiveContainer = document.getElementById('categoryDeepDiveContainer');
    const deepDiveSelect = document.getElementById('categoryDeepDiveSelect');
    if (!histContainer || !deepDiveContainer || !deepDiveSelect) return;

    try {
        const snapshot = await firestore.getArchivedBudgets(state.store.userId, state.store.activeBudgetId);
        if (snapshot.empty || snapshot.docs.length < 2) {
            histContainer.innerHTML = `<p class="text-center text-gray-500 mt-8">Archive at least two months to see trends.</p>`;
            deepDiveContainer.innerHTML = `<p class="text-center text-gray-500 mt-8">Not enough data for a deep dive.</p>`;
            deepDiveSelect.innerHTML = '';
            return;
        }

        const archives = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id));
        const labels = archives.map(archive => archive.id);
        const totalSpentData = archives.map(archive => (archive.categories || []).reduce((sum, cat) => sum + (cat.spent || 0), 0));
        const incomeData = archives.map(a => (a.incomeTransactions || []).reduce((sum, t) => sum + t.amount, 0));
        const netSavingsData = incomeData.map((income, i) => income - totalSpentData[i]);

        histContainer.innerHTML = `<canvas id="historicalSavingsChartCanvas"></canvas>`;
        const ctx = document.getElementById('historicalSavingsChartCanvas').getContext('2d');
        const histChart = new Chart(ctx, { type: 'line', data: { labels, datasets: [ { label: 'Total Spent', data: totalSpentData, borderColor: '#EF4444' }, { label: 'Total Income', data: incomeData, borderColor: '#22C55E', borderDash: [5, 5] }, { label: 'Net Savings', data: netSavingsData, borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.2 } ] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } });
        state.setHistoricalSavingsChart(histChart);

        const allCategoryNames = [...new Set(archives.flatMap(a => (a.categories || []).map(c => c.name)))].sort();
        deepDiveSelect.innerHTML = allCategoryNames.map(name => `<option value="${name}">${name}</option>`).join('');

        const renderDeepDive = () => {
            const selectedCategory = deepDiveSelect.value;
            if (!selectedCategory) { deepDiveContainer.innerHTML = ''; return; }
            const categoryData = archives.map(archive => { const category = (archive.categories || []).find(c => c.name === selectedCategory); return category ? (category.spent || 0) : 0; });
            deepDiveContainer.innerHTML = `<canvas id="categoryDeepDiveCanvas"></canvas>`;
            const deepDiveCtx = document.getElementById('categoryDeepDiveCanvas').getContext('2d');
            const ddChart = new Chart(deepDiveCtx, { type: 'bar', data: { labels, datasets: [{ label: `Spending for ${selectedCategory}`, data: categoryData, backgroundColor: '#8B5CF6' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } });
            state.setCategoryDeepDiveChart(ddChart);
};
        deepDiveSelect.onchange = renderDeepDive;
        renderDeepDive();
    } catch(error) {
        utils.logError('ui.renderHistoricalCharts', error);
        histContainer.innerHTML = `<p class="text-center text-red-500 mt-8">Could not load historical data.</p>`;
    }
}
