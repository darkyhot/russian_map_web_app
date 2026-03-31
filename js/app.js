/**
 * Main application logic
 */

(function () {
    let currentData = {};

    // Initialize map
    RussiaMap.init('#map', {
        onClick: showDetail,
        onHover: showTooltip,
        onLeave: hideTooltip
    });

    // File upload
    document.getElementById('file-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        document.getElementById('file-name').textContent = file.name;

        try {
            currentData = await ExcelParser.parseFile(file);
            RussiaMap.updateColors(currentData);
        } catch (err) {
            alert('Ошибка при чтении файла: ' + err.message);
            console.error(err);
        }
    });

    // Tooltip
    const tooltip = document.getElementById('tooltip');

    function showTooltip(event, regionName) {
        const info = RussiaMap.getRegionInfo(regionName);

        let html = `<div class="tip-title">${regionName}</div>`;

        if (info && info.metrics.length > 0) {
            for (const m of info.metrics) {
                const cls = m.completion >= 100 ? 'good' : 'bad';
                html += `<div class="tip-metric">
                    <span class="tip-metric-name">${m.name}</span>
                    <span class="tip-metric-val ${cls}">${m.completion.toFixed(1)}%</span>
                </div>`;
            }
            const total = info.metrics.reduce((s, m) => s + m.completion, 0);
            const avg = total / info.metrics.length;
            const totalCls = avg >= 100 ? 'good' : 'bad';
            html += `<div class="tip-metric tip-total">
                <span class="tip-metric-name">Среднее</span>
                <span class="tip-metric-val ${totalCls}">${avg.toFixed(1)}%</span>
            </div>`;
        } else {
            html += `<div style="color:#8a8a9a">Нет данных</div>`;
        }

        tooltip.innerHTML = html;
        tooltip.classList.remove('hidden');

        // Position
        const ttRect = tooltip.getBoundingClientRect();
        let x = event.clientX + 14;
        let y = event.clientY + 14;

        if (x + ttRect.width > window.innerWidth) {
            x = event.clientX - ttRect.width - 14;
        }
        if (y + ttRect.height > window.innerHeight) {
            y = event.clientY - ttRect.height - 14;
        }

        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
    }

    function hideTooltip() {
        tooltip.classList.add('hidden');
    }

    // Detail panel
    const detailPanel = document.getElementById('detail-panel');
    const detailTitle = document.getElementById('detail-title');
    const detailTbody = document.getElementById('detail-tbody');
    const detailTfoot = document.getElementById('detail-tfoot');

    function showDetail(regionName) {
        const info = RussiaMap.getRegionInfo(regionName);

        detailTitle.textContent = regionName;
        detailTbody.innerHTML = '';
        detailTfoot.innerHTML = '';

        if (!info || info.metrics.length === 0) {
            detailTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#8a8a9a;padding:20px;">Нет данных по региону</td></tr>';
            detailPanel.classList.remove('hidden');
            return;
        }

        let totalPlan = 0, totalFact = 0, totalCompletion = 0;

        for (const m of info.metrics) {
            const cls = m.completion >= 100 ? 'val-good' : 'val-bad';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${m.name}</td>
                <td>${formatNumber(m.plan)}</td>
                <td>${formatNumber(m.fact)}</td>
                <td class="${cls}">${m.completion.toFixed(1)}%</td>
            `;
            detailTbody.appendChild(row);
            totalPlan += m.plan;
            totalFact += m.fact;
            totalCompletion += m.completion;
        }

        const avg = totalCompletion / info.metrics.length;
        const cls = avg >= 100 ? 'val-good' : 'val-bad';
        detailTfoot.innerHTML = `<tr>
            <td><strong>Итого</strong></td>
            <td><strong>${formatNumber(totalPlan)}</strong></td>
            <td><strong>${formatNumber(totalFact)}</strong></td>
            <td class="${cls}"><strong>${avg.toFixed(1)}%</strong></td>
        </tr>`;

        detailPanel.classList.remove('hidden');
    }

    document.getElementById('detail-close').addEventListener('click', () => {
        detailPanel.classList.add('hidden');
    });

    // Close detail panel when clicking outside
    document.getElementById('map-container').addEventListener('click', (e) => {
        if (!e.target.closest('.region')) {
            detailPanel.classList.add('hidden');
        }
    });

    function formatNumber(n) {
        if (Number.isInteger(n)) return n.toLocaleString('ru-RU');
        return n.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    }
})();
