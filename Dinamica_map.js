// Torna a função showTab global para ser acessível via onclick no HTML
window.showTab = function showTab(id) {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(t => {
    t.style.display = 'none';
  });

  const selected = document.getElementById(id);
  if (selected) {
    selected.style.display = 'block';
  }
  // Se for a aba de "Ver preços", renderiza a lista
  if (id === 'tabView') {
    renderPriceList();
  }
};

document.addEventListener('DOMContentLoaded', initializeMap);

let map, gasMarkers, gasData, prices, control;
let selectingNewStation = false;
let newStationLocation = null;
let newStationMarker = null;

function initializeMap() {
  // === Inicialização do mapa ===
  map = L.map('map').setView([-8.0578, -34.8822], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  gasMarkers = L.layerGroup().addTo(map);
  gasData = []; // {id, name, coords, marker}
  prices = JSON.parse(localStorage.getItem('prices') || '{}');

  fetchGasStations();

  let fetchTimer;
  map.on('moveend', () => {
    clearTimeout(fetchTimer);
    fetchTimer = setTimeout(fetchGasStations, 700);
  });

  control = L.Routing.control({
    router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
    waypoints: [],
    routeWhileDragging: true,
    fitSelectedRoute: false
  }).addTo(map);

  control.on('routesfound', e => {
    const route = e.routes[0];
    const coordsLonLat = route.coordinates.map(c => [c.lng, c.lat]);
    const found = findStationsAlongRoute(coordsLonLat);
    const bounds = L.latLngBounds([]);
    route.coordinates.forEach(c => bounds.extend([c.lat, c.lng]));
    found.forEach(g => bounds.extend(g.marker.getLatLng()));
    map.fitBounds(bounds, { padding: [20, 20] });
  });

  let selectingWaypoints = false;
  let selectedPoints = [];
  let tempMarkers = [];

  function resetTempSelection() {
    selectedPoints = [];
    tempMarkers.forEach(m => map.removeLayer(m));
    tempMarkers = [];
  }

  const routeBtn = document.getElementById('routeBtn');
  const selectLocationBtn = document.getElementById('selectLocationBtn');
  const locationStatus = document.getElementById('locationStatus');
  const savePriceBtn = document.getElementById('savePriceBtn');

  if (selectLocationBtn) {
    selectLocationBtn.addEventListener('click', () => {
      // Limpa a seleção anterior
      if (newStationMarker) map.removeLayer(newStationMarker);
      newStationLocation = null;
      savePriceBtn.disabled = true;

      selectingNewStation = true;
      locationStatus.textContent = 'Clique no mapa para selecionar a localização do novo posto.';
      alert('Clique no mapa para selecionar a localização do novo posto.');
    });
  }
  if (routeBtn) {
    routeBtn.addEventListener('click', () => {
      resetTempSelection();
      selectingWaypoints = true;
      routeBtn.textContent = 'Selecione 2 pontos no mapa...';
    });
  } else {
    console.warn('Botão routeBtn não encontrado no DOM.');
  }

  map.on('click', (ev) => {
    // Lógica de seleção de rota
    if (selectingWaypoints) {
      const latlng = ev.latlng;
      const marker = L.marker(latlng).addTo(map);
      tempMarkers.push(marker);
      selectedPoints.push(latlng);

      if (selectedPoints.length === 2) {
        selectingWaypoints = false;
        if (routeBtn) routeBtn.textContent = 'Traçar rota';
        try {
          control.setWaypoints(selectedPoints);
        } catch (err) {
          console.error('Erro ao definir waypoints no control:', err);
          alert('Falha ao traçar rota. Veja o console para detalhes.');
        }
        resetTempSelection();
        selectedPoints = [];
      }
      return;
    }

    // Lógica de seleção de novo posto
    if (selectingNewStation) {
      selectingNewStation = false;
      if (newStationMarker) map.removeLayer(newStationMarker); // Remove marcador anterior

      newStationLocation = ev.latlng;
      newStationMarker = L.marker(newStationLocation).addTo(map);
      
      const locationStatus = document.getElementById('locationStatus');
      locationStatus.textContent = `Localização selecionada: Lat ${newStationLocation.lat.toFixed(4)}, Lon ${newStationLocation.lng.toFixed(4)}`;
      
      const savePriceBtn = document.getElementById('savePriceBtn');
      savePriceBtn.disabled = false;
      alert('Localização do novo posto selecionada. Agora insira o preço e salve.');
    }
  });

  // Garante que a aba inicial seja exibida
  showTab('tabRoute');
}

async function fetchGasStations() {
    gasMarkers.clearLayers();
    // Mantém apenas postos customizados (com prefixo 'custom_')
    gasData = gasData.filter(g => g.id.toString().startsWith('custom_')); 
    let fetchedGasData = [];
  const bounds = map.getBounds();
  const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
  const query = `[out:json][timeout:25];node["amenity"="fuel"](${bbox});out;`;
  const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);

    try {
      const res = await fetch(url);
      const json = await res.json();
      if (!json.elements) return;
      fetchedGasData = json.elements.map(e => {
      const lat = e.lat, lon = e.lon;
      const name = e.tags && (e.tags.name || 'Posto');
      const id = e.id;
      return { id, name, coords: [lon, lat], marker: null };
    });
    gasData = gasData.concat(fetchedGasData);
    } catch (err) {
      console.error("Erro ao buscar postos:", err);
    }

    // Adiciona os marcadores para todos os postos (Overpass + Cadastrados)
    gasData.forEach(g => {
      const price = prices[g.id];
      const color = price ? "red" : "#3388ff";
      const popup = price ? `<b>${g.name}</b><br>Preço: R$ ${price}` : `<b>${g.name}</b><br>Sem preço cadastrado`;
      g.marker = L.circleMarker([g.coords[1], g.coords[0]], { radius: 7, color }).bindPopup(popup).addTo(gasMarkers);
    });
    
    loadUpdateSelect();
  }

function findStationsAlongRoute(routeCoords) {
  const line = turf.lineString(routeCoords);
  const buffer = turf.buffer(line, 0.2, { units: 'kilometers' });
  const listEl = document.getElementById('list');
  if (listEl) listEl.innerHTML = '';
  const found = [];

  gasData.forEach(g => {
    const pt = turf.point(g.coords);
    if (turf.booleanPointInPolygon(pt, buffer)) {
      found.push(g);
      const price = prices[g.id];
      g.marker.setStyle({ radius: 9, color: price ? "red" : "green" });
      const li = document.createElement('li');
      li.textContent = price ? `${g.name} — R$ ${price}` : `${g.name} — sem preço`;
      if (listEl) listEl.appendChild(li);
    } else {
      g.marker.setStyle({ radius: 6, color: prices[g.id] ? "red" : "#3388ff" });
    }
  });

  if (window._bufferLayer) map.removeLayer(window._bufferLayer);
  window._bufferLayer = L.geoJSON(buffer, { color: "green", weight: 2, fillOpacity: 0.1 }).addTo(map);
  return found;
}



window.loadUpdateSelect = function loadUpdateSelect() {
  const sel = document.getElementById('updateSelect');
  if (!sel) return;
  
  // Filtra apenas postos com preço cadastrado
  const stationsWithPrice = Object.keys(prices).map(id => {
    const g = gasData.find(x => x.id == id);
    if (g) {
      return { id: g.id, name: g.name };
    } else {
      // Caso o posto tenha sido removido do Overpass, mas ainda tenha preço
      return { id: id, name: `Posto (ID: ${id})` };
    }
  }).filter(g => g !== null);

  sel.innerHTML = stationsWithPrice.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
};

window.savePrice = function savePrice() {
  const priceInput = document.getElementById('addPrice');
  const price = parseFloat(priceInput.value);
  const stationNameInput = document.getElementById('stationName');
  const name = stationNameInput.value.trim() || 'Novo Posto';
  const savePriceBtn = document.getElementById('savePriceBtn');

  if (!newStationLocation || isNaN(price)) { 
    alert('Selecione a localização no mapa e insira um preço válido.'); 
    return; 
  }

  // Gera um ID único (usando timestamp para garantir unicidade)
  // Usaremos um prefixo para diferenciar de IDs do Overpass
  const id = 'custom_' + Date.now().toString(); 
  
  // Adiciona o novo posto aos dados
  gasData.push({ 
    id: id, 
    name: name, 
    coords: [newStationLocation.lng, newStationLocation.lat], 
    marker: null // O marcador será criado no fetchGasStations
  });

  // Salva o preço
  prices[id] = price.toFixed(2);
  localStorage.setItem('prices', JSON.stringify(prices));

  // Limpa o estado de seleção
  if (newStationMarker) map.removeLayer(newStationMarker);
  newStationLocation = null;
  newStationMarker = null;
  savePriceBtn.disabled = true;
  priceInput.value = '';
  stationNameInput.value = '';
  document.getElementById('locationStatus').textContent = 'Clique no botão acima e depois no mapa.';

  fetchGasStations();
  alert(`Posto "${name}" cadastrado com sucesso!`);
};

window.updatePrice = function updatePrice() {
  const id = document.getElementById('updateSelect').value;
  const priceInput = document.getElementById('updatePrice');
  const price = parseFloat(priceInput.value);
  if (!id || isNaN(price)) { alert('Selecione um posto e insira o novo preço.'); return; }
  prices[id] = price.toFixed(2);
  localStorage.setItem('prices', JSON.stringify(prices));
  fetchGasStations();
  priceInput.value = ''; // Limpa o campo após atualizar
  alert('Preço atualizado!');
};

window.renderPriceList = function renderPriceList() {
  const list = document.getElementById('stationList');
  if (!list) return;
  list.innerHTML = Object.entries(prices).map(([id, price]) => {
    const g = gasData.find(x => x.id == id);
    const name = g ? g.name : `Posto ${id}`;
    return `<li><b>${name}</b>: R$ ${price}</li>`;
  }).join('');
};
