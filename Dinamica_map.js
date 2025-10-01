// Inicializa o mapa centralizado em Recife como exemplo
const map = L.map('map').setView([-8.0578, -34.8822], 13);

// TileLayer (mapa base do OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

// Grupo para marcadores de postos
let gasMarkers = L.layerGroup().addTo(map);
let gasData = []; // {id, name, coords, marker}

// Função: buscar postos de combustível (Overpass API)
async function fetchGasStations() {
  gasMarkers.clearLayers();
  gasData = [];

  const bounds = map.getBounds();
  const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;

  // Consulta Overpass: todos os "amenity=fuel"
  const query = `[out:json][timeout:25];node["amenity"="fuel"](${bbox});out;`;
  const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);

  try {
    const res = await fetch(url);
    const json = await res.json();

    json.elements.forEach(e => {
      const lat = e.lat, lon = e.lon;
      const name = e.tags && (e.tags.name || 'Posto');
      const marker = L.circleMarker([lat, lon], { radius: 6, color: "#3388ff" })
        .addTo(gasMarkers)
        .bindPopup(`<b>${name}</b>`);

      gasData.push({ id: e.id, name, coords: [lon, lat], marker });
    });
  } catch (err) {
    console.error("Erro ao buscar postos:", err);
  }
}

// Buscar sempre que mover o mapa
let fetchTimer;
map.on('moveend', () => {
  clearTimeout(fetchTimer);
  fetchTimer = setTimeout(fetchGasStations, 600);
});
fetchGasStations();

// Controle de rota (usa servidor público do OSRM via HTTPS)
const control = L.Routing.control({
  router: L.Routing.osrmv1({
    serviceUrl: 'https://router.project-osrm.org/route/v1'
  }),
  waypoints: [],
  routeWhileDragging: true,
  // Vamos fazer o fit manualmente para aplicar padding do sidebar
  fitSelectedRoute: false
}).addTo(map);

// Quando a rota é encontrada
control.on('routesfound', function (e) {
  const route = e.routes[0];
  const coordsLonLat = route.coordinates.map(c => [c.lng, c.lat]); // [lon,lat]
  const found = findStationsAlongRoute(coordsLonLat);

  // Construir bounds combinando rota e postos encontrados
  const bounds = L.latLngBounds([]);
  route.coordinates.forEach(c => bounds.extend([c.lat, c.lng]));
  found.forEach(g => bounds.extend(g.marker.getLatLng()));

  // Sidebar está ao lado; padding padrão
  map.fitBounds(bounds, {
    padding: [20, 20]
  });
});

// Lógica: selecionar dois pontos ao clicar no botão "Traçar rota"
let selectingWaypoints = false;
let selectedPoints = [];
let tempMarkers = [];

function resetTempSelection() {
  selectedPoints = [];
  tempMarkers.forEach(m => map.removeLayer(m));
  tempMarkers = [];
}

const routeBtn = document.getElementById('routeBtn');
if (routeBtn) {
  routeBtn.addEventListener('click', () => {
    resetTempSelection();
    selectingWaypoints = true;
    routeBtn.textContent = 'Selecione 2 pontos no mapa…';
  });
}

map.on('click', (ev) => {
  if (!selectingWaypoints) return;
  const latlng = ev.latlng;
  const marker = L.marker(latlng).addTo(map);
  tempMarkers.push(marker);
  selectedPoints.push(latlng);

  if (selectedPoints.length === 2) {
    selectingWaypoints = false;
    if (routeBtn) routeBtn.textContent = 'Traçar rota';
    control.setWaypoints(selectedPoints);
    resetTempSelection();
  }
});

// Função: encontrar postos próximos à rota
function findStationsAlongRoute(routeCoords) {
  const line = turf.lineString(routeCoords);
  const buffer = turf.buffer(line, 0.2, { units: 'kilometers' }); // 200m

  // Resetar estilos e limpar lista
  gasData.forEach(g => g.marker.setStyle({ radius: 6, color: "#3388ff" }));
  document.getElementById('list').innerHTML = '';

  // Verificar cada posto
  const found = [];
  gasData.forEach(g => {
    const pt = turf.point(g.coords);
    if (turf.booleanPointInPolygon(pt, buffer)) {
      found.push(g);
    }
  });

  // Destacar no mapa e adicionar na lista
  found.forEach(g => {
    g.marker.setStyle({ radius: 8, color: "red" });
    if (g.marker.bringToFront) g.marker.bringToFront();
    const li = document.createElement('li');
    li.textContent = g.name;
    document.getElementById('list').appendChild(li);
  });

  // Mostrar buffer no mapa (debug)
  if (window._bufferLayer) map.removeLayer(window._bufferLayer);
  window._bufferLayer = L.geoJSON(buffer, { color: "green", weight: 2, fillOpacity: 0.1 }).addTo(map);

  return found;
}
