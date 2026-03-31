/**
 * Excel parser for region metrics.
 *
 * Expected Excel format:
 * | Регион | Метрика1 План | Метрика1 Факт | Метрика1 Выполнение | Метрика2 План | ... |
 *
 * Column headers are detected by suffix: "план", "факт", "выполнение"
 * Metric name is extracted by removing the suffix.
 */

const ExcelParser = (() => {

    function parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                    const result = processRows(json);
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    function processRows(rows) {
        if (!rows.length) return {};

        const headers = Object.keys(rows[0]);

        // First column is region name
        const regionCol = headers[0];

        // Detect metric groups from remaining headers
        const metricCols = headers.slice(1);
        const metrics = detectMetrics(metricCols);

        const regionData = {};

        for (const row of rows) {
            const regionName = normalizeRegionName(String(row[regionCol]).trim());
            if (!regionName) continue;

            const metricValues = [];
            for (const metric of metrics) {
                const plan = parseNumber(row[metric.planCol]);
                const fact = parseNumber(row[metric.factCol]);
                const completion = metric.completionCol
                    ? parseNumber(row[metric.completionCol])
                    : (plan !== 0 ? (fact / plan) * 100 : 0);

                metricValues.push({
                    name: metric.name,
                    plan: plan,
                    fact: fact,
                    completion: Math.round(completion * 100) / 100
                });
            }

            regionData[regionName] = {
                originalName: String(row[regionCol]).trim(),
                metrics: metricValues
            };
        }

        return regionData;
    }

    function detectMetrics(cols) {
        const metrics = [];
        const used = new Set();

        // Group columns by metric name
        const groups = {};
        for (const col of cols) {
            const lower = col.toLowerCase().trim();
            let type = null;
            let name = '';

            if (lower.endsWith('план')) {
                type = 'plan';
                name = col.slice(0, col.toLowerCase().lastIndexOf('план')).trim();
            } else if (lower.endsWith('факт')) {
                type = 'fact';
                name = col.slice(0, col.toLowerCase().lastIndexOf('факт')).trim();
            } else if (lower.endsWith('выполнение') || lower.endsWith('%') || lower.endsWith('выполнение %') || lower.endsWith('выполнение, %')) {
                type = 'completion';
                name = col.slice(0, col.toLowerCase().search(/(выполнение|%)/)).trim();
            }

            if (type && name) {
                // Remove trailing punctuation from name
                name = name.replace(/[,.\s]+$/, '');
                if (!groups[name]) groups[name] = {};
                groups[name][type] = col;
            }
        }

        for (const [name, group] of Object.entries(groups)) {
            if (group.plan && group.fact) {
                metrics.push({
                    name: name,
                    planCol: group.plan,
                    factCol: group.fact,
                    completionCol: group.completion || null
                });
            }
        }

        // Fallback: if no groups detected, try triplet pattern (every 3 columns = plan, fact, completion)
        if (metrics.length === 0 && cols.length >= 3) {
            for (let i = 0; i + 2 < cols.length; i += 3) {
                const name = extractMetricName(cols[i], cols[i + 1], cols[i + 2]);
                metrics.push({
                    name: name || `Метрика ${Math.floor(i / 3) + 1}`,
                    planCol: cols[i],
                    factCol: cols[i + 1],
                    completionCol: cols[i + 2]
                });
            }
        }

        return metrics;
    }

    function extractMetricName(planCol, factCol, compCol) {
        // Try to find common prefix
        const parts = [planCol, factCol, compCol].map(c =>
            c.toLowerCase().replace(/(план|факт|выполнение|%|,)/g, '').trim()
        );
        // Return the most common non-empty part
        const counts = {};
        for (const p of parts) {
            if (p) counts[p] = (counts[p] || 0) + 1;
        }
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        return sorted.length > 0 ? sorted[0][0] : '';
    }

    function parseNumber(val) {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const s = String(val).replace(/\s/g, '').replace(',', '.').replace('%', '');
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    }

    function normalizeRegionName(name) {
        // Remove common prefixes/suffixes for matching
        return name
            .replace(/\s+/g, ' ')
            .trim();
    }

    return { parseFile };
})();
