const map = new maplibregl.Map({

    container: 'map',
    style: 'https://demotiles.maplibre.org/style.json',
    center: [0, 20],
    zoom: 2

});

map.addControl(new maplibregl.NavigationControl());

let originalData = null;
let activePopup = null;

// -----------------------------
function cleanCountry(c) {
    if (Array.isArray(c)) return c.join(", ");
    if (!c) return "Unknown";
    return c;
}

// -----------------------------
function closePopup() {
    if (activePopup) {
        activePopup.remove();
        activePopup = null;
    }
}

// -----------------------------
function createPopup(coords, p) {

    closePopup();

    const icon =
        p.category === 'Natural' ? '🌳' :
        p.category === 'Mixed' ? '⭐' :
        '🏛';

    activePopup = new maplibregl.Popup()
        .setLngLat(coords)
        .setHTML(`
            <div style="font-family:Inter;font-size:13px;line-height:1.4;">
                <b>${icon} ${p.name_en}</b><br><br>
                <b>Category:</b> ${p.category}<br>
                <b>Year:</b> ${p.date_inscribed}<br>
                <b>Country:</b> ${cleanCountry(p.states_names)}
            </div>
        `)
        .addTo(map);
}

// -----------------------------
map.on('load', () => {

    // ✅ UPDATED PATH (NO data/ folder anymore)
    fetch('unesco.geojson')
        .then(res => res.json())
        .then(data => {

            originalData = data;

            map.addSource('unesco', {
                type: 'geojson',
                data: data
            });

            map.addLayer({
                id: 'unesco-sites',
                type: 'circle',
                source: 'unesco',
                paint: {

                    'circle-radius': 5,

                    'circle-color': [
                        'match',
                        ['get', 'category'],
                        'Natural', '#2E8B57',
                        'Mixed', '#DAA520',
                        '#1E90FF'
                    ],

                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#ffffff'
                }
            });

            setupFilters(data);
            setupSearch();
            updateStats(data.features);

            map.on('click', 'unesco-sites', (e) => {
                const f = e.features[0];
                createPopup(f.geometry.coordinates, f.properties);
            });

        });

});

// -----------------------------
function setupSearch() {

    const searchBox = document.getElementById('searchBox');

    searchBox.addEventListener('keydown', (e) => {

        if (e.key !== 'Enter') return;

        const q = searchBox.value.toLowerCase();

        const match = originalData.features.find(f =>
            (f.properties.name_en || "").toLowerCase().includes(q)
        );

        if (!match) return alert("Site not found");

        const coords = match.geometry.coordinates;

        map.flyTo({
            center: coords,
            zoom: 7,
            speed: 1.3
        });

        map.once('moveend', () => {
            createPopup(coords, match.properties);
        });

    });
}

// -----------------------------
function setupFilters(data) {

    const countrySet = new Set();

    data.features.forEach(f => {
        countrySet.add(cleanCountry(f.properties.states_names));
    });

    const countryFilter = document.getElementById('countryFilter');
    const categoryFilter = document.getElementById('categoryFilter');

    [...countrySet].sort().forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        countryFilter.appendChild(opt);
    });

    countryFilter.addEventListener('change', applyFilter);
    categoryFilter.addEventListener('change', applyFilter);
}

// -----------------------------
function applyFilter() {

    const country = document.getElementById('countryFilter').value;
    const category = document.getElementById('categoryFilter').value;

    const filtered = originalData.features.filter(f => {

        const c = cleanCountry(f.properties.states_names);

        return (
            (country === "all" || c === country) &&
            (category === "all" || f.properties.category === category)
        );

    });

    map.getSource('unesco').setData({
        type: "FeatureCollection",
        features: filtered
    });

    updateStats(filtered);
}

// -----------------------------
function updateStats(features) {

    let cultural = 0;
    let natural = 0;
    let mixed = 0;

    features.forEach(f => {
        if (f.properties.category === "Natural") natural++;
        else if (f.properties.category === "Mixed") mixed++;
        else cultural++;
    });

    document.getElementById("statsBox").innerHTML = `
        <b>Live Stats</b><br><br>

        🏛 Cultural: ${cultural}<br>
        🌳 Natural: ${natural}<br>
        ⭐ Mixed: ${mixed}
    `;
}