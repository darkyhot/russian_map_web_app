/**
 * Russia map renderer using D3.js
 */

const RussiaMap = (() => {
    let svg, g, projection, pathGenerator;
    let zoom;
    let regionData = {};
    let onRegionClick = null;
    let onRegionHover = null;
    let onRegionLeave = null;

    function init(svgSelector, callbacks) {
        onRegionClick = callbacks.onClick;
        onRegionHover = callbacks.onHover;
        onRegionLeave = callbacks.onLeave;

        svg = d3.select(svgSelector);
        g = svg.append('g');

        // Zoom behavior
        zoom = d3.zoom()
            .scaleExtent([0.5, 12])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);

        // Handle resize
        window.addEventListener('resize', debounce(fitMap, 200));

        return loadGeoJSON();
    }

    function loadGeoJSON() {
        return d3.json('data/russia.geojson').then(geojson => {
            drawMap(geojson);
            return geojson;
        });
    }

    function drawMap(geojson) {
        const container = document.getElementById('map-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Albers projection optimized for Russia
        projection = d3.geoAlbers()
            .rotate([-105, 0])
            .center([0, 65])
            .parallels([52, 75])
            .fitSize([width, height], geojson);

        pathGenerator = d3.geoPath().projection(projection);

        g.selectAll('.region')
            .data(geojson.features)
            .join('path')
            .attr('class', 'region no-data')
            .attr('d', pathGenerator)
            .attr('data-name', d => d.properties.name)
            .on('click', (event, d) => {
                event.stopPropagation();
                if (onRegionClick) onRegionClick(d.properties.name);
            })
            .on('mouseenter', (event, d) => {
                if (onRegionHover) onRegionHover(event, d.properties.name);
            })
            .on('mousemove', (event, d) => {
                if (onRegionHover) onRegionHover(event, d.properties.name);
            })
            .on('mouseleave', () => {
                if (onRegionLeave) onRegionLeave();
            })
            // Touch support
            .on('touchstart', (event, d) => {
                event.preventDefault();
                if (onRegionHover) {
                    const touch = event.touches[0];
                    onRegionHover({ clientX: touch.clientX, clientY: touch.clientY }, d.properties.name);
                }
            })
            .on('touchend', (event, d) => {
                event.preventDefault();
                if (onRegionLeave) onRegionLeave();
                if (onRegionClick) onRegionClick(d.properties.name);
            });
    }

    function updateColors(data) {
        regionData = data;
        g.selectAll('.region')
            .attr('class', d => {
                const name = d.properties.name;
                const match = findRegionData(name, data);
                if (!match) return 'region no-data';
                return 'region ' + (isRegionGood(match) ? 'good' : 'bad');
            });
    }

    function findRegionData(geoName, data) {
        // Direct match
        if (data[geoName]) return data[geoName];

        // Normalized matching
        const geoNorm = geoName.toLowerCase().trim();
        for (const [key, val] of Object.entries(data)) {
            const keyNorm = key.toLowerCase().trim();
            if (keyNorm === geoNorm) return val;
            // Partial match: one contains the other
            if (keyNorm.includes(geoNorm) || geoNorm.includes(keyNorm)) return val;
            // Match without common suffixes
            const geoClean = geoNorm.replace(/(область|край|республика|автономный округ|автономная область|город)/g, '').trim();
            const keyClean = keyNorm.replace(/(область|край|республика|автономный округ|автономная область|город)/g, '').trim();
            if (geoClean && keyClean && (geoClean.includes(keyClean) || keyClean.includes(geoClean))) return val;
        }
        return null;
    }

    function isRegionGood(regionInfo) {
        const metrics = regionInfo.metrics;
        if (!metrics || metrics.length === 0) return true;
        const totalCompletion = metrics.reduce((sum, m) => sum + m.completion, 0);
        return totalCompletion >= metrics.length * 100;
    }

    function getRegionInfo(geoName) {
        return findRegionData(geoName, regionData);
    }

    function fitMap() {
        const container = document.getElementById('map-container');
        const width = container.clientWidth;
        const height = container.clientHeight;
        svg.call(zoom.transform, d3.zoomIdentity);
    }

    function debounce(fn, ms) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
        };
    }

    return { init, updateColors, getRegionInfo, findRegionData, isRegionGood };
})();
