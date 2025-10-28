/* script.js — versão integrada Overpass + SPA
   Mantém usuários e postos locais; adiciona postos OSM via Overpass (não editáveis).
   - Persistência: localStorage 'stations', 'users', 'currentUser'
   - Postos locais: id começa com 'p_' (editáveis)
   - Postos OSM: id começa com 'osm_' (não editáveis)
*/

let map;
let gasMarkers;
let gasDataLocal = [];     // postos persistidos (localStorage) - editáveis
let gasDataRemote = [];    // postos vindos do Overpass (somente leitura)
let users = [];
let currentUser = null;

let tempMarker = null;            // marcador temporário ao selecionar localização para cadastro
let selectingLocationForPosto = false;
let returnScreenId = null;
let previousScreenId = null;

let selectingWaypoints = false;
let tempWaypoints = [];
let tempWayMarkers = [];
let routeControl = null;
let fetchTimer = null;
let overpassDebounceTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initMap();
  setupUI();
  renderAllMarkers();
  updateProfileIcon();
});

/* -------------------------
   Persistência (localStorage)
   ------------------------- */
function loadData() {
  try { gasDataLocal = JSON.parse(localStorage.getItem('stations') || '[]'); } catch(e) { gasDataLocal = []; }
  try { users = JSON.parse(localStorage.getItem('users') || '[]'); } catch(e) { users = []; }
  try { currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch(e) { currentUser = null; }
}
function saveData() {
  localStorage.setItem('stations', JSON.stringify(gasDataLocal));
  localStorage.setItem('users', JSON.stringify(users));
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
}

/* -------------------------
   Map init
   ------------------------- */
function initMap() {
  map = L.map('map', { zoomControl: true }).setView([-8.0578, -34.8822], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  gasMarkers = L.layerGroup().addTo(map);

  // click handler (seleção de localização para cadastro / traçar rota manual)
  map.on('click', (e) => {
    if (selectingWaypoints) {
      const m = L.marker(e.latlng).addTo(map);
      tempWayMarkers.push(m);
      tempWaypoints.push([e.latlng.lat, e.latlng.lng]);
      if (tempWaypoints.length === 2) {
        // desenha polyline e reseta
        if (routeControl) { try { map.removeControl(routeControl); } catch(_) {} routeControl = null; }
        const routeLayer = L.polyline(tempWaypoints, { color: '#1976d2', weight: 5, opacity: 0.9 }).addTo(map);
        map.fitBounds(L.latLngBounds(tempWaypoints).pad(0.2));
        selectingWaypoints = false;
        tempWaypoints = [];
        tempWayMarkers.forEach(x => map.removeLayer(x));
        tempWayMarkers = [];
        showToast('Rota desenhada (modo manual)');
      } else {
        showToast('Ponto 1 registrado. Selecione o ponto 2.');
      }
      hideQuickMenu();
      return;
    }

    if (selectingLocationForPosto) {
      if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
      tempMarker = L.marker(e.latlng, { draggable: true }).addTo(map);
      selectingLocationForPosto = false;
      if (returnScreenId) showScreen(returnScreenId);
      const el = document.getElementById('locInfoScreen') || document.getElementById('locInfo');
      if (el) el.textContent = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
      showToast('Local selecionado. Volte à tela de cadastro e salve.');
    }
  });

  // Buscar postos Overpass quando o mapa pára de se mover (debounce)
  map.on('moveend', () => {
    if (overpassDebounceTimer) clearTimeout(overpassDebounceTimer);
    overpassDebounceTimer = setTimeout(() => fetchGasStationsOverpass(), 700);
  });

  // Carrega imediatamente
  fetchGasStationsOverpass();
}

/* -------------------------
   Fetch Overpass (postos OSM)
   ------------------------- */
async function fetchGasStationsOverpass() {
  // Bbox no formato sul, oeste, norte, leste
  try {
    const bounds = map.getBounds();
    const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
    const query = `[out:json][timeout:25];node["amenity"="fuel"](${bbox});out;`;
    const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);

    const res = await fetch(url);
    const json = await res.json();
    if (!json.elements) return;

    // converte elementos para formato interno (id como 'osm_<id>')
    const remote = json.elements.map(e => ({
      id: 'osm_' + e.id.toString(),
      name: e.tags && (e.tags.name || 'Posto OSM'),
      coords: [e.lat, e.lon],
      prices: { gas: null, etanol: null, diesel: null }, // não persistir
      editable: false // marca explicitamente
    }));

    // filtra duplicados com postos locais (evita colocar OSM sobre posto local)
    const localCoordsSet = new Set(gasDataLocal.map(s => `${s.coords[0].toFixed(6)},${s.coords[1].toFixed(6)}`));
    gasDataRemote = remote.filter(r => {
      const key = `${r.coords[0].toFixed(6)},${r.coords[1].toFixed(6)}`;
      return !localCoordsSet.has(key);
    });

    renderAllMarkers();
  } catch (err) {
    console.error('Erro Overpass:', err);
  }
}

/* -------------------------
   Render marcadores (local + remote)
   ------------------------- */
function renderAllMarkers(filter = '') {
  gasMarkers.clearLayers();
  const q = (filter || '').trim().toLowerCase();

  // função auxiliar para criar popup e bind handlers
  function addMarkerForStation(s, isLocal) {
    const hasPrice = s.prices && (s.prices.gas || s.prices.etanol || s.prices.diesel);
    const color = hasPrice ? 'red' : '#1976d2';
    const marker = L.circleMarker([s.coords[0], s.coords[1]], { radius: 8, color, fillOpacity: 0.9, weight: 2 }).addTo(gasMarkers);

    let priceHtml = '';
    if (s.prices) {
      priceHtml = `<div style="font-size:13px;margin-top:6px">
        Gasolina: ${s.prices.gas ?? '--'}<br>
        Etanol: ${s.prices.etanol ?? '--'}<br>
        Diesel: ${s.prices.diesel ?? '--'}
      </div>`;
    }

    const editableLabel = isLocal ? '<div style="margin-top:8px"><button id="popup-edit-' + s.id + '" class="popup-edit">Ver / Editar</button></div>' : '';

    const popupHtml = `
      <div style="font-weight:700">${escapeHtml(s.name)}</div>
      <div style="color:#555;font-size:13px">${isLocal ? '(Posto cadastrado)' : '(Posto do OpenStreetMap)'}</div>
      ${priceHtml}
      ${editableLabel}
    `;
    marker.bindPopup(popupHtml);

    marker.on('popupopen', () => {
      setTimeout(() => {
        const btn = document.getElementById(`popup-edit-${s.id}`);
        if (btn) btn.addEventListener('click', () => {
          if (isLocal) openEditPricesForPosto(s.id);
          else showToast('Posto vindo do OSM — não é editável pelo app.');
        });
      }, 40);
    });
  }

  // Render locais (editáveis)
  gasDataLocal.forEach(s => {
    if (q && !s.name.toLowerCase().includes(q)) return;
    addMarkerForStation(s, true);
  });

  // Render remotos (OSM) — não-editáveis
  gasDataRemote.forEach(s => {
    if (q && !s.name.toLowerCase().includes(q)) return;
    addMarkerForStation(s, false);
  });
}

/* -------------------------
   UI and navigation (screens)
   ------------------------- */
function setupUI() {
  document.getElementById('addBtn')?.addEventListener('click', (ev) => { ev.stopPropagation(); toggleQuickMenu(); });
  document.addEventListener('click', (ev) => {
    const qm = document.getElementById('quickMenu');
    if (!qm) return;
    if (!qm.contains(ev.target) && ev.target.id !== 'addBtn') hideQuickMenu();
  });

  document.getElementById('quickCadastrarPosto')?.addEventListener('click', () => {
    hideQuickMenu();
    showScreen('screenRegisterPosto');
  });
  document.getElementById('quickCadastrarUser')?.addEventListener('click', () => {
    hideQuickMenu();
    showScreen('screenRegisterUser');
  });
  document.getElementById('quickTraçarRotas')?.addEventListener('click', () => {
    hideQuickMenu();
    // tenta ativar L.Routing se disponível
    if (window.L && L.Routing && L.Routing.control) {
      enableRoutingControl();
      showToast('Modo rota ativado (Routing Machine). Clique para adicionar waypoints no controle.');
    } else {
      // fallback para modo manual
      selectingWaypoints = true;
      if (routeControl) { try { map.removeControl(routeControl); } catch(_) {} routeControl = null; }
      tempWaypoints = []; tempWayMarkers.forEach(m => map.removeLayer(m)); tempWayMarkers = [];
      showToast('Modo traçar rotas (manual) ativado. Selecione 2 pontos no mapa.');
    }
  });

  document.getElementById('profileBtn')?.addEventListener('click', () => { showScreen('screenProfile'); renderProfileScreen(); });

  document.getElementById('searchInput')?.addEventListener('input', (e) => renderAllMarkers(e.target.value));

  // topbar back button
  document.getElementById('topbarBackBtn')?.addEventListener('click', () => {
    if (currentScreenId) {
      hideScreen(currentScreenId);
      currentScreenId = null;
    }
  });

  // Save user screen
  document.getElementById('saveUserScreenBtn')?.addEventListener('click', () => {
    const name = document.getElementById('userNameScreen').value.trim();
    const email = document.getElementById('userEmailScreen').value.trim();
    const pass = document.getElementById('userPassScreen').value;
    if (!name || !email || !pass) { showToast('Preencha todos os campos.'); return; }
    const id = 'u_' + Date.now();
    const user = { id, name, email, pass, type: 'user' };
    users.push(user); currentUser = user; saveData();
    hideScreen('screenRegisterUser'); updateProfileIcon(); showToast('Usuário cadastrado e logado');
  });

  // select location for posto (screen)
  document.getElementById('selectOnMapScreenBtn')?.addEventListener('click', () => {
    selectingLocationForPosto = true;
    returnScreenId = 'screenRegisterPosto';
    hideScreen('screenRegisterPosto');
    showToast('Toque no mapa para selecionar a localização do posto');
  });

  // save posto (screen)
  document.getElementById('savePostoScreenBtn')?.addEventListener('click', () => {
    const name = document.getElementById('postoNameScreen').value.trim();
    const cnpj = document.getElementById('postoCnpjScreen').value.trim();
    if (!name || !cnpj) { showToast('Preencha nome e CNPJ do posto'); return; }
    if (!tempMarker) { showToast('Selecione a localização no mapa'); return; }
    const latlng = tempMarker.getLatLng();
    const id = 'p_' + Date.now();
    const posto = { id, name, cnpj, coords: [latlng.lat, latlng.lng], prices: { gas: null, etanol: null, diesel: null } };
    gasDataLocal.push(posto);

    // criar conta "posto" simples e logar como posto
    const postoUser = { id: 'u_' + Date.now() + '_p', name, email: null, pass: null, type: 'posto', postoId: id };
    users.push(postoUser); currentUser = postoUser;

    if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
    document.getElementById('locInfoScreen').textContent = 'Nenhum local selecionado';
    saveData(); hideScreen('screenRegisterPosto'); renderAllMarkers(); updateProfileIcon();
    showToast('Posto cadastrado e logado como posto');
  });

  // save prices (screen)
  document.getElementById('savePricesBtn')?.addEventListener('click', () => {
    const gas = parseFloat(document.getElementById('priceGas').value) || null;
    const etanol = parseFloat(document.getElementById('priceEtanol').value) || null;
    const diesel = parseFloat(document.getElementById('priceDiesel').value) || null;
    const editingPostoId = document.getElementById('editPostoName').dataset.postoId;
    const posto = gasDataLocal.find(s => s.id === editingPostoId);
    if (!posto) { showToast('Posto não encontrado (somente postos cadastrados localmente podem ser editados).'); return; }
    posto.prices = { gas, etanol, diesel };
    saveData();
    renderAllMarkers();
    hideScreen('screenEditPrices');
    if (previousScreenId) {
      showScreen(previousScreenId);
      previousScreenId = null;
    }
    showToast('Preços atualizados');
  });
  document.getElementById('cancelPricesBtn')?.addEventListener('click', () => {
    hideScreen('screenEditPrices');
    if (previousScreenId) {
      showScreen(previousScreenId);
      previousScreenId = null;
    }
  });

  // keyboard escape
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (currentScreenId) hideScreen(currentScreenId); selectingWaypoints = false; hideQuickMenu(); } });
}

/* Quick menu helpers */
function toggleQuickMenu() {
  const qm = document.getElementById('quickMenu'); if (!qm) return;
  qm.classList.toggle('hidden'); qm.setAttribute('aria-hidden', qm.classList.contains('hidden') ? 'true' : 'false');
}
function hideQuickMenu() { const qm = document.getElementById('quickMenu'); if (!qm) return; qm.classList.add('hidden'); qm.setAttribute('aria-hidden','true'); }

/* Topbar helpers */
function setTopbarForMap(isMapVisible) {
  const profileBtn = document.getElementById('profileBtn');
  const searchWrap = document.querySelector('.search-wrap');
  if (profileBtn) profileBtn.style.display = isMapVisible ? '' : 'none';
  if (searchWrap) searchWrap.style.display = isMapVisible ? '' : 'none';
}

/* Screens show/hide */
let currentScreenId = null;
function showScreen(id) {
  hideQuickMenu();
  const screen = document.getElementById(id);
  if (!screen) return;
  screen.classList.remove('hidden'); screen.setAttribute('aria-hidden','false');
  currentScreenId = id;
  setTopbarForMap(false);
  const addBtn = document.getElementById('addBtn'); const topback = document.getElementById('topbarBackBtn');
  if (addBtn) addBtn.style.display = 'none';
  if (topback) topback.classList.remove('hidden');
}
function hideScreen(id) {
  const screen = document.getElementById(id);
  if (!screen) return;
  screen.classList.add('hidden'); screen.setAttribute('aria-hidden','true');
  const anyScreenVisible = !!document.querySelector('.screen:not(.hidden)');
  if (!anyScreenVisible) {
    setTopbarForMap(true);
    const addBtn = document.getElementById('addBtn'); const topback = document.getElementById('topbarBackBtn');
    if (addBtn) addBtn.style.display = '';
    if (topback) topback.classList.add('hidden');
    currentScreenId = null;
  } else {
    const vis = document.querySelector('.screen:not(.hidden)');
    currentScreenId = vis ? vis.id : null;
  }
}

/* -------------------------
   Perfil / telas de usuário (reaproveitado)
   ------------------------- */
function renderProfileScreen(focusPostoId = null) {
  const container = document.getElementById('profileContentScreen');
  container.innerHTML = '';
  if (!currentUser && !focusPostoId) {
    container.innerHTML = `
      <div style="padding:12px">
        <h3>Bem-vindo</h3>
        <p class="muted">Cadastre-se como usuário ou posto para acessar funcionalidades.</p>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button id="profileGotoCadScreen">Cadastrar</button>
          <button id="profileCloseBtnScreen" class="btn-secondary">Fechar</button>
        </div>
      </div>`;
    document.getElementById('profileGotoCadScreen')?.addEventListener('click', ()=>{ hideScreen('screenProfile'); showScreen('screenRegisterUser'); });
    document.getElementById('profileCloseBtnScreen')?.addEventListener('click', ()=> hideScreen('screenProfile'));
    return;
  }

  if (focusPostoId) {
    const posto = gasDataLocal.find(s => s.id === focusPostoId) || gasDataRemote.find(s => s.id === focusPostoId);
    if (!posto) { container.innerHTML = '<p>Posto não encontrado</p>'; return; }
    container.innerHTML = `
      <div class="profile-card">
        <div class="profile-avatar"><i class="fa-solid fa-gas-pump"></i></div>
        <div class="profile-info">
          <div style="font-weight:700">${escapeHtml(posto.name)}</div>
          <div class="muted">${escapeHtml(posto.cnpj || '')}</div>
          <div style="margin-top:8px">Preços:
            <div class="muted">Gasolina: ${posto.prices?.gas ?? '--'}</div>
            <div class="muted">Etanol: ${posto.prices?.etanol ?? '--'}</div>
            <div class="muted">Diesel: ${posto.prices?.diesel ?? '--'}</div>
          </div>
        </div>
      </div>
      <div style="margin-top:12px"><button id="profileCloseViewScreen" class="btn-secondary">Fechar</button></div>
    `;
    document.getElementById('profileCloseViewScreen')?.addEventListener('click', ()=> hideScreen('screenProfile'));
    return;
  }

  if (currentUser && currentUser.type === 'user') {
    container.innerHTML = `
      <div class="profile-card">
        <div class="profile-avatar"><i class="fa-solid fa-user"></i></div>
        <div class="profile-info">
          <div style="font-weight:700">${escapeHtml(currentUser.name)}</div>
          <div class="muted">${escapeHtml(currentUser.email || '')}</div>
        </div>
      </div>
      <div style="margin-top:12px">
        <button id="denounceBtnScreen" class="btn-secondary">Denunciar posto por preços falsos</button>
        <button id="logoutBtnScreen" style="margin-left:8px;background:#e11d48">Sair</button>
      </div>
    `;
    document.getElementById('denounceBtnScreen')?.addEventListener('click', ()=> alert('Denúncia simulada.'));
    document.getElementById('logoutBtnScreen')?.addEventListener('click', ()=> { currentUser = null; saveData(); updateProfileIcon(); hideScreen('screenProfile'); showToast('Desconectado'); });
    return;
  }

  if (currentUser && currentUser.type === 'posto') {
    const posto = gasDataLocal.find(s => s.id === currentUser.postoId);
    container.innerHTML = `
      <div class="profile-card">
        <div class="profile-avatar"><i class="fa-solid fa-gas-pump"></i></div>
        <div class="profile-info">
          <div style="font-weight:700">${escapeHtml(posto ? posto.name : currentUser.name)}</div>
          <div class="muted">${posto ? escapeHtml(posto.cnpj) : ''}</div>
        </div>
      </div>
      <div style="margin-top:12px">
        <button id="editPricesBtnScreen">Editar preços de combustível</button>
        <button id="logoutPostoBtnScreen" style="margin-left:8px;background:#e11d48">Sair</button>
      </div>
    `;
    document.getElementById('editPricesBtnScreen')?.addEventListener('click', ()=> {
      if (!posto) { showToast('Posto vinculado não encontrado'); return; }
      previousScreenId = 'screenProfile';
      hideScreen('screenProfile');
      const elName = document.getElementById('editPostoName');
      elName.textContent = posto.name; elName.dataset.postoId = posto.id;
      document.getElementById('priceGas').value = posto.prices.gas || '';
      document.getElementById('priceEtanol').value = posto.prices.etanol || '';
      document.getElementById('priceDiesel').value = posto.prices.diesel || '';
      showScreen('screenEditPrices');
    });
    document.getElementById('logoutPostoBtnScreen')?.addEventListener('click', ()=> { currentUser = null; saveData(); updateProfileIcon(); hideScreen('screenProfile'); showToast('Desconectado'); });
    return;
  }
}

/* -------------------------
   Abrir edição de preços por posto
   - somente postos locais (gasDataLocal) são editáveis
   ------------------------- */
function openEditPricesForPosto(postoId) {
  const posto = gasDataLocal.find(s => s.id === postoId);
  if (!posto) {
    showToast('Apenas postos cadastrados no app podem ser editados.');
    return;
  }
  previousScreenId = currentScreenId || null;
  const elName = document.getElementById('editPostoName');
  elName.textContent = posto.name; elName.dataset.postoId = posto.id;
  document.getElementById('priceGas').value = posto.prices.gas || '';
  document.getElementById('priceEtanol').value = posto.prices.etanol || '';
  document.getElementById('priceDiesel').value = posto.prices.diesel || '';
  if (currentScreenId === 'screenProfile') hideScreen('screenProfile');
  showScreen('screenEditPrices');
}

/* -------------------------
   Helpers: toast, escapeHtml, updateProfileIcon
   ------------------------- */
function showToast(msg, ms = 2200) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.remove('hidden'); clearTimeout(t._timeout); t._timeout = setTimeout(()=> t.classList.add('hidden'), ms); }
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function updateProfileIcon() { const btn = document.getElementById('profileBtn'); if (!btn) return; btn.innerHTML = currentUser ? '<i class="fa-solid fa-user-check"></i>' : '<i class="fa-solid fa-user"></i>'; saveData(); }

/* -------------------------
   Routing integration (Leaflet Routing Machine if disponível)
   ------------------------- */
function enableRoutingControl() {
  if (!window.L || !L.Routing) {
    showToast('Leaflet Routing Machine não carregado — modo manual ativado.');
    selectingWaypoints = true;
    return;
  }

  if (routeControl) {
    try { map.removeControl(routeControl); } catch (e) {}
    routeControl = null;
  }

  routeControl = L.Routing.control({
    router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
    waypoints: [],
    routeWhileDragging: true,
    showAlternatives: false,
    fitSelectedRoute: false
  }).addTo(map);

  routeControl.on('routesfound', function(e) {
    const route = e.routes[0];
    if (!route || !route.coordinates) return;
    // transforma coordinates para [lng, lat] para o turf (se disponível)
    const coordsLonLat = route.coordinates.map(c => [c.lng, c.lat]);
    highlightStationsAlongRoute(coordsLonLat);
    // ajusta bounds incluindo postos encontrados
    try {
      const bounds = L.latLngBounds([]);
      route.coordinates.forEach(c => bounds.extend([c.lat, c.lng]));
      gasDataLocal.concat(gasDataRemote).forEach(s => bounds.extend([s.coords[0], s.coords[1]]));
      map.fitBounds(bounds, { padding: [20,20] });
    } catch(_) {}
  });
}

/* Highlight stations along route usando turf (se disponível) */
function highlightStationsAlongRoute(coordsLonLat) {
  // coordsLonLat = array [ [lng,lat], ... ]
  if (!window.turf) {
    showToast('turf.js não disponível — sem destaque de postos.');
    return;
  }
  const line = turf.lineString(coordsLonLat);
  // buffer em 0.2 km
  const buffer = turf.buffer(line, 0.2, { units: 'kilometers' });
  // remove buffer antigo se existir
  if (window._bufferLayer) try { map.removeLayer(window._bufferLayer); } catch(_) {}
  window._bufferLayer = L.geoJSON(buffer, { color: "green", weight: 2, fillOpacity: 0.1 }).addTo(map);

  // limpa estilos e destaca os que estiverem no buffer
  const all = gasDataLocal.concat(gasDataRemote);
  all.forEach(s => {
    const pt = turf.point([s.coords[1], s.coords[0]]); // turf usa [lng, lat]
    const markerLatLng = [s.coords[0], s.coords[1]];
    // procure o marker dentro do layerGroup e altere style (simples approach: recriar)
    // Para simplicidade, vamos recriar marcadores: renderAllMarkers() já limpa e redesenha.
  });

  // Para simplicidade: apenas re-renderiza e deixa buffer visível; os marcadores com preço aparecem em vermelho.
  renderAllMarkers();
}

/* -------------------------
   Utilitários: abrir perfil do posto / fechar edição
   ------------------------- */
function openProfileForPosto(postoId) {
  showScreen('screenProfile'); renderProfileScreen(postoId);
}
function closeEditPrices() { hideElement('editPricesSheet'); }
function showElement(id) { const el = document.getElementById(id); if (el) { el.classList.remove('hidden'); el.setAttribute('aria-hidden','false'); } }
function hideElement(id) { const el = document.getElementById(id); if (el) { el.classList.add('hidden'); el.setAttribute('aria-hidden','true'); } }

/* -------------------------
   Pequenas helpers extras
   ------------------------- */

/* Permite busca por nome já implementada na UI: searchInput listener chama renderAllMarkers(filter) */

/* -------------------------
   Nota: Caso precise forçar atualização de postos locais/remotos
   ------------------------- */
window.forceRefreshOverpass = function() {
  fetchGasStationsOverpass();
  renderAllMarkers();
};
