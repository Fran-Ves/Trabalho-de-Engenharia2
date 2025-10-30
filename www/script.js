/* script.js — versão corrigida (modo "versão 2")
   - posts reais via Overpass SÓ são buscados quando o usuário entra no fluxo de cadastro/edição de posto
   - duplicatas removidas, sintaxe corrigida, inicialização do mapa ajustada
*/

let map;
let control;
let gasMarkers;
let gasData = [];
let _bufferLayer = null;
let users = [];
let currentUser = null;
let tempMarker = null;
let selectingLocationForPosto = false;
let returnScreenId = null;
let previousScreenId = null;
let currentScreenId = null;
let _overpassDebounceId = null;
let _suppressMoveendFetch = false;

let selectingWaypoints = false;
let tempWaypoints = [];
let tempWayMarkers = [];
let routeFoundStations = []; // postos encontrados na rota

// controle: buscar Overpass apenas quando permitido (modo edição de posto)
let allowOverpass = false;

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initMap();
  setupUI();
  renderAllMarkers(); // renderiza os postos locais (gasData) — normalmente vazio até cadastros manuais
  updateProfileIcon();
});

/* -------------------------
   Persistência (localStorage)
   ------------------------- */
function loadData() {
  try { gasData = JSON.parse(localStorage.getItem('stations') || '[]'); } catch(e) { gasData = []; }
  try { users = JSON.parse(localStorage.getItem('users') || '[]'); } catch(e) { users = []; }
  try { currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch(e) { currentUser = null; }
}
function saveData() {
  localStorage.setItem('stations', JSON.stringify(gasData));
  localStorage.setItem('users', JSON.stringify(users));
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
}

/* -------------------------
   Inicializa o mapa e control
   ------------------------- */
function initMap() {
  // Coordenadas iniciais: 07º 04' 37" S, 41º 28' 01" W -> (-7.076944, -41.466944)
  map = L.map('map', { zoomControl: true }).setView([-7.076944, -41.466944], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  gasMarkers = L.layerGroup().addTo(map);

  control = L.Routing.control({
    router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
    waypoints: [],
    routeWhileDragging: true,
    fitSelectedRoute: false,
    show: false
  }).addTo(map);

  control.on('routesfound', e => {
    const route = e.routes[0];
    // route.coordinates é array de {lat, lng}
    const coordsLonLat = route.coordinates.map(c => [c.lng, c.lat]); // turf espera [lon, lat] em pontos, mas lineString aceita [lon,lat] array
    routeFoundStations = findStationsAlongRoute(coordsLonLat);

    // Ajustar bounds para rota + postos encontrados
    const bounds = L.latLngBounds([]);
    route.coordinates.forEach(c => bounds.extend([c.lat, c.lng]));
    routeFoundStations.forEach(g => {
      if (Array.isArray(g.coords) && g.coords.length === 2) {
        bounds.extend([g.coords[0], g.coords[1]]);
      }
    });
    if (bounds.isValid()) {
      // Evita disparar fetch por moveend provocado pelo fitBounds
      _suppressMoveendFetch = true;
      map.fitBounds(bounds, { padding: [20, 20] });
      setTimeout(() => { _suppressMoveendFetch = false; }, 800);
    }

    // garantir marcadores presentes: buscar Overpass uma vez se estiver desativado
    if (!allowOverpass) {
      allowOverpass = true;
      fetchGasStationsFromOverpass().then(() => {
        renderAllMarkers();
        renderRouteStationsPanel(routeFoundStations);
      }).catch(()=>{
        renderAllMarkers();
        renderRouteStationsPanel(routeFoundStations);
      });
    } else {
      renderRouteStationsPanel(routeFoundStations);
    }
    showToast('Rota traçada. Postos no caminho listados.');
  });

  // Clique no mapa: seleção de waypoints ou seleção de localização de posto
  map.on('click', (e) => {
    if (selectingWaypoints) {
      const m = L.marker(e.latlng).addTo(map);
      tempWayMarkers.push(m);
      tempWaypoints.push([e.latlng.lat, e.latlng.lng]);

      if (tempWaypoints.length === 2) {
        // Temos dois pontos: traçar rota
        selectingWaypoints = false;

        try {
          // Converte para L.latLng e define waypoints
          control.setWaypoints([
            L.latLng(tempWaypoints[0][0], tempWaypoints[0][1]),
            L.latLng(tempWaypoints[1][0], tempWaypoints[1][1])
          ]);
        } catch (err) {
          console.error('Erro ao definir waypoints no control:', err);
          showToast('Falha ao traçar rota. Veja o console para detalhes.');
        }

        // remove marcadores temporários
        tempWayMarkers.forEach(x => map.removeLayer(x));
        tempWayMarkers = [];
        tempWaypoints = [];

        // Botão "Traçar Rotas"
        document.getElementById('quickTraçarRotas')?.addEventListener('click', () => {
          hideQuickMenu();
          selectingWaypoints = true;
          control.setWaypoints([]);
          if (_bufferLayer) { map.removeLayer(_bufferLayer); _bufferLayer = null; }
          routeFoundStations = [];
          document.getElementById('quickVerRotas')?.classList.add('hidden');

          tempWaypoints = [];
          tempWayMarkers.forEach(m => map.removeLayer(m));
          tempWayMarkers = [];

          { const el = document.getElementById('quickTraçarRotas'); if (el) el.textContent = 'Selecione 2 pontos no mapa...'; }
          showToast('Modo traçar rotas ativado. Selecione 2 pontos no mapa.');
        });


      }
    }
    if (selectingLocationForPosto) {
      if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
      tempMarker = L.marker(e.latlng, { draggable: true }).addTo(map);
      selectingLocationForPosto = false;
      if (returnScreenId) showScreen(returnScreenId);

      const el = document.getElementById('locInfoScreen') || document.getElementById('locInfo');
      if (el) el.textContent = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
      showToast('Local selecionado. Retorne à tela de cadastro para salvar.');
    }
   });

  // Só escuta moveend para buscar Overpass se permitido (com debounce)
  map.on('moveend', () => {
    if (!allowOverpass) return;
    if (_suppressMoveendFetch) return;
    if (_overpassDebounceId) clearTimeout(_overpassDebounceId);
    _overpassDebounceId = setTimeout(() => {
      fetchGasStationsFromOverpass();
    }, 600);
  });
}

/* -------------------------
   Overpass: buscar postos reais (somente quando permitido)
   ------------------------- */
async function fetchGasStationsFromOverpass() {
  if (!allowOverpass) return;
  if (!map) return;

  // mantemos separação de preços salvos localmente
  const prices = JSON.parse(localStorage.getItem('prices') || '{}');

  // Não limpar marcadores antes para evitar flicker durante timeouts; atualizamos depois

  const bounds = map.getBounds();
  const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
  const query = `[out:json][timeout:25];node["amenity"="fuel"](${bbox});out;`;
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];
  let lastErr = null;

  try {
    for (const base of endpoints) {
      try {
        const url = base + '?data=' + encodeURIComponent(query);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          const txt = await res.text();
          throw new Error(`Unexpected content-type: ${ct} — body starts with: ${txt.slice(0,120)}`);
        }
        const json = await res.json();
        // transform e sair do loop em sucesso
        const overpassStations = (json.elements || []).map(e => ({
          id: 'osm_' + e.id,
          name: e.tags?.name || 'Posto',
          coords: [e.lat, e.lon],
          cnpj: e.tags?.ref || '',
          prices: prices['osm_' + e.id] || { gas: null, etanol: null, diesel: null },
          osm: true
        }));
        const manual = gasData.filter(s => !s.osm);
        gasData = manual.concat(overpassStations);
        renderAllMarkers();
        return;
      } catch (e) {
        lastErr = e;
        continue;
      }
    }
    // se chegou aqui, todas falharam
    throw lastErr || new Error('Overpass indisponível');
  } catch (err) {
    console.error("Erro ao buscar Overpass:", err);
    showToast('Erro ao buscar postos reais (Overpass). Veja console.');
  }
}

/* -------------------------
   Render marcadores e lista de rota
   ------------------------- */
function findStationsAlongRoute(routeCoords) {
  // routeCoords: array de [lon, lat] OU [lng, lat]; turf.lineString espera [lon, lat] pontos
  const line = turf.lineString(routeCoords);
  const buffer = turf.buffer(line, 0.2, { units: 'kilometers' });
  const found = [];

  gasData.forEach(g => {
    if (!g.coords || g.coords.length < 2) return;
    // turf.point espera [lon, lat]
    const pt = turf.point([g.coords[1], g.coords[0]]);
    if (turf.booleanPointInPolygon(pt, buffer)) found.push(g);
  });

  // Ordena por preço gasolina (se disponível)
  found.sort((a, b) => {
    const priceA = (a.prices && a.prices.gas) ? a.prices.gas : Infinity;
    const priceB = (b.prices && b.prices.gas) ? b.prices.gas : Infinity;
    if (priceA === priceB) return 0;
    if (priceA === Infinity) return 1;
    if (priceB === Infinity) return -1;
    return priceA - priceB;
  });

  renderRouteStationsList(found); // legado (tela antiga)
  renderRouteStationsPanel(found); // novo painel compacto

  if (_bufferLayer) map.removeLayer(_bufferLayer);
  _bufferLayer = L.geoJSON(buffer, { color: "#1976d2", weight: 2, fillOpacity: 0.1 }).addTo(map);
  renderAllMarkers(); // para destacar os que estão na rota

  return found;
}

function renderRouteStationsList(stations) {
  const listEl = document.getElementById('routeStationsList');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (!stations || stations.length === 0) {
    listEl.innerHTML = '<li>Nenhum posto encontrado na rota.</li>';
    return;
  }

  stations.forEach(s => {
    const price = s.prices?.gas;
    const li = document.createElement('li');
    li.className = 'route-station-item';
    li.innerHTML = `
      <div class="station-info">
        <b>${escapeHtml(s.name)}</b>
        <span class="price-tag">${price ? `R$ ${Number(price).toFixed(2)}` : 'Sem preço'}</span>
      </div>
    `;
    listEl.appendChild(li);
  });
}

function renderRouteStationsPanel(stations) {
  const sidebar = document.getElementById('sidebar');
  const list = document.getElementById('routeSidebarList');
  const info = document.getElementById('routeInfoCompact');
  if (!sidebar || !list || !info) return;
  list.innerHTML = '';
  if (!stations || stations.length === 0) {
    info.textContent = 'Nenhuma rota';
    list.innerHTML = '<li><span class="name">Nenhum posto na rota.</span></li>';
  } else {
    info.textContent = `${stations.length} postos encontrados`;
    stations.forEach(s => {
      const li = document.createElement('li');
      const price = s.prices?.gas;
      li.innerHTML = `<span class="name">${escapeHtml(s.name)}</span><span class="price">${price ? `R$ ${Number(price).toFixed(2)}` : '--'}</span>`;
      li.addEventListener('click', () => {
        try {
          const latlng = L.latLng(s.coords[0], s.coords[1]);
          map.setView(latlng, Math.max(map.getZoom(), 15));
        } catch(e) {}
      });
      list.appendChild(li);
    });
  }
  sidebar.classList.remove('hidden');
  sidebar.setAttribute('aria-hidden','false');
}

function renderAllMarkers(filter = '') {
  try { gasMarkers.clearLayers(); } catch(e) { gasMarkers = L.layerGroup().addTo(map); }

  const q = (filter || '').trim().toLowerCase();

  gasData.forEach(s => {
    if (!s.coords || s.coords.length < 2) return;
    const hasPrice = s.prices && (s.prices.gas || s.prices.etanol || s.prices.diesel);
    const onRoute = routeFoundStations.some(rs => rs.id === s.id);

    let color = hasPrice ? 'red' : '#1976d2';
    let radius = 8;
    if (onRoute) { color = hasPrice ? '#00bfa5' : '#ffc107'; radius = 10; }

    const marker = L.circleMarker([s.coords[0], s.coords[1]], { radius, color, fillOpacity: 0.9, weight: 2 }).addTo(gasMarkers);
    const popupHtml = `
      <div style="font-weight:700">${escapeHtml(s.name)}</div>
      <div style="font-size:13px;color:#444">${escapeHtml(s.cnpj || '')}</div>
      <div style="margin-top:8px">
        <p>Gasolina: ${s.prices?.gas != null ? `R$ ${s.prices.gas}` : 'N/A'}</p>
        <p>Etanol: ${s.prices?.etanol != null ? `R$ ${s.prices.etanol}` : 'N/A'}</p>
        <p>Diesel: ${s.prices?.diesel != null ? `R$ ${s.prices.diesel}` : 'N/A'}</p>
      </div>
      <div style="margin-top:8px"><button id="popup-edit-${s.id}" class="popup-edit">Ver/Editar (Posto)</button></div>
    `;
    marker.bindPopup(popupHtml);

    if (q && !s.name.toLowerCase().includes(q)) marker.setStyle({ opacity: 0.25, fillOpacity: 0.25 });

    marker.on('popupopen', () => {
      setTimeout(() => {
        const btn = document.getElementById(`popup-edit-${s.id}`);
        if (btn) btn.addEventListener('click', () => openProfileForPosto(s.id));
      }, 50);
    });
    if (onRoute) {
      try { marker.openPopup(); } catch(e) {}
    }
  });
}

function openDenounceScreen() {
  showScreen('screenDenounce');
  renderDenounceStep1();
}

function renderDenounceStep1() {
  const select = document.getElementById('denouncePostoSelect');
  const step1 = document.getElementById('denounceStep1');
  const step2 = document.getElementById('denounceStep2');
  step2.classList.add('hidden');
  step1.classList.remove('hidden');

  select.innerHTML = '<option value="">-- Escolha um posto --</option>';
  gasData.forEach(p => {
    if (!p.name) return;
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
}

function renderDenounceStep2(postoId) {
  const posto = gasData.find(p => p.id === postoId);
  if (!posto) return showToast('Posto não encontrado');

  const step1 = document.getElementById('denounceStep1');
  const step2 = document.getElementById('denounceStep2');
  step1.classList.add('hidden');
  step2.classList.remove('hidden');

  const nameEl = document.getElementById('denouncePostoName');
  nameEl.textContent = posto.name;

  const fuelDiv = document.getElementById('denounceFuelOptions');
  fuelDiv.innerHTML = '';
  const fuels = posto.prices || {};

  const entries = [
    ['Gasolina', fuels.gas],
    ['Etanol', fuels.etanol],
    ['Diesel', fuels.diesel]
  ];

  entries.forEach(([label, price]) => {
    const btn = document.createElement('button');
    btn.textContent = `${label}: ${price != null ? `R$ ${price}` : 'N/A'}`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('#denounceFuelOptions button').forEach(b => b.style.background = '#f8fafc');
      btn.style.background = '#e0f2fe';
      fuelDiv.dataset.selectedFuel = label;
    });
    fuelDiv.appendChild(btn);
  });
}

function submitDenounce() {
  const select = document.getElementById('denouncePostoSelect');
  const posto = gasData.find(p => p.id === select.value);
  const selectedFuel = document.getElementById('denounceFuelOptions').dataset.selectedFuel;

  if (!posto || !selectedFuel) {
    return showToast('Selecione o combustível incorreto.');
  }

  const denuncias = JSON.parse(localStorage.getItem('denuncias') || '[]');
  const novaDenuncia = {
    postoId: posto.id,
    postoNome: posto.name,
    fuel: selectedFuel,
    userEmail: currentUser?.email || 'Anônimo',
    date: new Date().toLocaleString()
  };

  denuncias.push(novaDenuncia);
  localStorage.setItem('denuncias', JSON.stringify(denuncias));

  hideScreen('screenDenounce');
  showToast(`Denúncia enviada para ${posto.name}`);
}



/* -------------------------
   UI e navegação (screens)
   ------------------------- */
function setupUI() {
  // quick menu ações
  document.getElementById('quickVerRotas')?.addEventListener('click', () => {
    hideQuickMenu();
    renderRouteStationsPanel(routeFoundStations);
  });

  document.getElementById('backFromRouteBtn')?.addEventListener('click', () => {
    hideScreen('screenRoute');
  });

  document.getElementById('addBtn')?.addEventListener('click', (ev) => { ev.stopPropagation(); toggleQuickMenu(); });
  // Substituir quickMenu pelo sidebar ao clicar no +
  document.getElementById('addBtn')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const sb = document.getElementById('sidebar');
    if (sb) {
      sb.classList.toggle('hidden');
      sb.setAttribute('aria-hidden', sb.classList.contains('hidden') ? 'true' : 'false');
    }
  });
  
  document.getElementById('quickLoginUser')?.addEventListener('click', () => {
    hideQuickMenu();
    showScreen('screenLoginUser');
  });

  document.getElementById('sbLoginUser')?.addEventListener('click', () => {
    // Esconde a sidebar ao abrir a tela de login
    const sb = document.getElementById('sidebar'); 
    if (sb) { 
      sb.classList.add('hidden'); 
      sb.setAttribute('aria-hidden','true'); 
    }
    showScreen('screenLoginUser');
  });

  // Lógica do botão "Entrar" da tela de Login
  // Alternância entre login de usuário e posto
  const btnLoginUser = document.getElementById('btnLoginUser');
  const btnLoginPosto = document.getElementById('btnLoginPosto');
  const loginUserFields = document.getElementById('loginUserFields');
  const loginPostoFields = document.getElementById('loginPostoFields');
  let loginMode = 'user';

  btnLoginUser?.addEventListener('click', () => {
    loginMode = 'user';
    btnLoginUser.style.background = '#1976d2';
    btnLoginUser.style.color = '#fff';
    btnLoginPosto.style.background = '#f1f5f9';
    btnLoginPosto.style.color = '#000';
    loginUserFields.classList.remove('hidden');
    loginPostoFields.classList.add('hidden');
  });

  btnLoginPosto?.addEventListener('click', () => {
    loginMode = 'posto';
    btnLoginPosto.style.background = '#1976d2';
    btnLoginPosto.style.color = '#fff';
    btnLoginUser.style.background = '#f1f5f9';
    btnLoginUser.style.color = '#000';
    loginPostoFields.classList.remove('hidden');
    loginUserFields.classList.add('hidden');
  });

  // Botão "Entrar"
  document.getElementById('loginUserScreenBtn')?.addEventListener('click', () => {
    if (loginMode === 'user') {
      const email = document.getElementById('loginEmailScreen').value.trim();
      const pass = document.getElementById('loginPassScreen').value;
      if (!email || !pass) return showToast('Preencha e-mail e senha.');

      const user = users.find(u => u.email === email && u.pass === pass && u.type === 'user');
      if (user) {
        currentUser = user;
        saveData();
        updateProfileIcon();
        hideScreen('screenLoginUser');
        showToast(`Bem-vindo(a), ${user.name}!`);
      } else {
        showToast('E-mail ou senha incorretos.');
      }

    } else if (loginMode === 'posto') {
      const name = document.getElementById('loginPostoNameScreen').value.trim().toLowerCase();
      const cnpj = document.getElementById('loginPostoCnpjScreen').value.trim();
      if (!name || !cnpj) return showToast('Preencha nome e CNPJ.');

      const normalizeCNPJ = c => c.replace(/\D/g, '');
      const posto = gasData.find(p => 
        p.name.toLowerCase() === name &&
        normalizeCNPJ(p.cnpj) === normalizeCNPJ(cnpj)
      );
      
      if (posto) {
        currentUser = { id: posto.id, name: posto.name, cnpj: posto.cnpj, type: 'posto', postoId: posto.id };
        saveData();
        updateProfileIcon();
        hideScreen('screenLoginUser');
        showToast(`Posto ${posto.name} conectado!`);
      } else {
        showToast('Nome ou CNPJ incorretos.');
      }
    }
  });


  document.addEventListener('click', (ev) => {
    const qm = document.getElementById('quickMenu');
    if (!qm) return;
    if (!qm.contains(ev.target) && ev.target.id !== 'addBtn') hideQuickMenu();
  });
  document.getElementById('sidebarClose')?.addEventListener('click', () => {
    const sb = document.getElementById('sidebar'); if (sb) { sb.classList.add('hidden'); sb.setAttribute('aria-hidden','true'); }
  });
  // Ações do sidebar
  document.getElementById('sbCadastrarPosto')?.addEventListener('click', () => document.getElementById('quickCadastrarPosto')?.click());
  document.getElementById('sbCadastrarUser')?.addEventListener('click', () => document.getElementById('quickCadastrarUser')?.click());
  document.getElementById('sbTracarRotas')?.addEventListener('click', () => document.getElementById('quickTraçarRotas')?.click());

  // abrir screen de cadastro de posto (permite Overpass)
  document.getElementById('quickCadastrarPosto')?.addEventListener('click', () => {
    hideQuickMenu();
    // Ao abrir tela de cadastro de posto, habilitamos a busca de postos reais na área atual
    allowOverpass = true;
    // busca imediata e também passa a ouvir moveend
    fetchGasStationsFromOverpass();
    showScreen('screenRegisterPosto');
  });

  // cadastrar usuário (sem Overpass)
  document.getElementById('quickCadastrarUser')?.addEventListener('click', () => {
    hideQuickMenu();
    showScreen('screenRegisterUser');
  });

  // traçar rotas — ativa modo de selecionar 2 pontos
  document.getElementById('quickTraçarRotas')?.addEventListener('click', () => {
    hideQuickMenu();
    selectingWaypoints = true;
    control.setWaypoints([]);
    if (_bufferLayer) { try { map.removeLayer(_bufferLayer); } catch(e){} _bufferLayer = null; }
    routeFoundStations = [];
    document.getElementById('quickVerRotas')?.classList.add('hidden');

    tempWaypoints = [];
    tempWayMarkers.forEach(m => { try { map.removeLayer(m); } catch(e){} });
    tempWayMarkers = [];

    { const el = document.getElementById('quickTraçarRotas'); if (el) el.textContent = 'Selecione 2 pontos no mapa...'; }
    showToast('Modo traçar rotas ativado. Selecione 2 pontos no mapa.');
  });

  // profile button
  document.getElementById('profileBtn')?.addEventListener('click', () => {
    showScreen('screenProfile');
    renderProfileScreen();
  });
  // fechar painel da rota ao abrir telas
  document.getElementById('routePanelClose')?.addEventListener('click', () => {
    const p = document.getElementById('routePanel'); if (p) { p.classList.add('hidden'); p.setAttribute('aria-hidden','true'); }
  });

  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');

  if (searchInput && searchResults) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();
      if (!query) {
        searchResults.classList.add('hidden');
        renderAllMarkers('');
        return;
      }

      const matches = gasData.filter(p => p.name && p.name.toLowerCase().includes(query));
      renderAllMarkers(query);

      if (matches.length === 0) {
        searchResults.innerHTML = `<div>Nenhum posto encontrado</div>`;
        searchResults.classList.remove('hidden');
        return;
      }

      searchResults.innerHTML = matches
        .map(p => `<div data-id="${p.id}">${escapeHtml(p.name)}</div>`)
        .join('');
      searchResults.classList.remove('hidden');
    });

    // Clique em resultado
    searchResults.addEventListener('click', (e) => {
      const div = e.target.closest('div[data-id]');
      if (!div) return;
      const id = div.dataset.id;
      const posto = gasData.find(p => p.id === id);
      if (!posto || !posto.coords) return;

      map.setView([posto.coords[0], posto.coords[1]], 17);

      // abrir popup do marcador correspondente
      const markerLayer = gasMarkers.getLayers().find(m => {
        const ll = m.getLatLng?.();
        return ll && ll.lat === posto.coords[0] && ll.lng === posto.coords[1];
      });
      if (markerLayer) markerLayer.openPopup();

      searchResults.classList.add('hidden');
      searchInput.value = posto.name;
    });

  // Ocultar lista ao clicar fora
  document.addEventListener('click', (e) => {
    if (!searchResults.contains(e.target) && e.target !== searchInput) {
      searchResults.classList.add('hidden');
    }
  });
}


  // back topbar
  document.getElementById('topbarBackBtn')?.addEventListener('click', () => {
    if (currentScreenId) {
      hideScreen(currentScreenId);
      currentScreenId = null;
    }
    // Limpa rota e buffer ao voltar
    control.setWaypoints([]);
    if (_bufferLayer) { try { map.removeLayer(_bufferLayer); } catch(e){} _bufferLayer = null; }
    routeFoundStations = [];
    renderAllMarkers();
  });

  // back buttons internos (podem não existir — usamos ?)
  document.getElementById('backFromUser')?.addEventListener('click', () => hideScreen('screenRegisterUser'));
  document.getElementById('backFromPosto')?.addEventListener('click', () => hideScreen('screenRegisterPosto'));
  document.getElementById('backFromProfile')?.addEventListener('click', () => hideScreen('screenProfile'));

  document.getElementById('nextToDenouncePricesBtn')?.addEventListener('click', () => {
    const select = document.getElementById('denouncePostoSelect');
    if (!select.value) return showToast('Selecione um posto primeiro');
    renderDenounceStep2(select.value);
  });
  
  document.getElementById('cancelDenounceBtn')?.addEventListener('click', () => {
    hideScreen('screenDenounce');
  });
  
  document.getElementById('backToDenounceSelectBtn')?.addEventListener('click', () => {
    const fuelDiv = document.getElementById('denounceFuelOptions');
    if (fuelDiv) fuelDiv.dataset.selectedFuel = '';
    renderDenounceStep1();
  });
  
  
  document.getElementById('submitDenounceBtn')?.addEventListener('click', () => {
    submitDenounce();
  });
  

  // salvar usuário
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

  // selecionar localização no mapa para posto
  document.getElementById('selectOnMapScreenBtn')?.addEventListener('click', () => {
    selectingLocationForPosto = true;
    returnScreenId = 'screenRegisterPosto';
    hideScreen('screenRegisterPosto');
    showToast('Toque no mapa para selecionar a localização do posto');
  });

  // salvar posto (manual)
  document.getElementById('savePostoScreenBtn')?.addEventListener('click', () => {
    const name = document.getElementById('postoNameScreen').value.trim();
    const cnpj = document.getElementById('postoCnpjScreen').value.trim();
    if (!name || !cnpj) { showToast('Preencha nome e CNPJ do posto'); return; }
    if (!tempMarker) { showToast('Selecione a localização no mapa'); return; }
    const latlng = tempMarker.getLatLng();
    const id = 'p_' + Date.now();
    const posto = { id, name, cnpj, coords: [latlng.lat, latlng.lng], prices: { gas: null, etanol: null, diesel: null } };
    gasData.push(posto);
    const postoUser = { id: 'u_' + Date.now() + '_p', name, email: null, pass: null, type: 'posto', postoId: id };
    users.push(postoUser); currentUser = postoUser;
    if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
    document.getElementById('locInfoScreen').textContent = 'Nenhum local selecionado';
    saveData(); hideScreen('screenRegisterPosto'); renderAllMarkers(); updateProfileIcon();
    showToast('Posto cadastrado e logado como posto');
  });

  // editar preços (salvar / cancelar)
  document.getElementById('savePricesBtn')?.addEventListener('click', () => {
    const gas = parseFloat(document.getElementById('priceGas').value) || null;
    const etanol = parseFloat(document.getElementById('priceEtanol').value) || null;
    const diesel = parseFloat(document.getElementById('priceDiesel').value) || null;
    const editingPostoId = document.getElementById('editPostoName')?.dataset.postoId;
    const posto = gasData.find(s => s.id === editingPostoId);
    if (!posto) { showToast('Posto não encontrado'); return; }
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
    if (previousScreenId) { showScreen(previousScreenId); previousScreenId = null; }
  });

  // Escape keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (currentScreenId) hideScreen(currentScreenId);
      selectingWaypoints = false;
      hideQuickMenu();
    }
  });
}

/* -------------------------
   Screens show/hide + Profile render
   ------------------------- */
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

function renderProfileScreen() {
  const content = document.getElementById('profileContentScreen');
  let html = '';

  if (!currentUser) {
    html = `
      <p>Você ainda não está logado.</p>
      <div class="actions">
        <button type="button" id="gotoRegisterBtn">Cadastrar-se</button>
      </div>
    `;
  } 
  else if (currentUser.type === 'posto') {
    html += `
      <div class="profile-card">
        <div class="profile-avatar"><i class="fa-solid fa-gas-pump"></i></div>
        <div class="profile-info">
          <b>${currentUser.name}</b><br>
          <span class="muted">CNPJ: ${currentUser.cnpj || '-'}</span>
        </div>
      </div>
      <div class="profile-actions">
        <button id="editPricesBtn">Editar preços</button>
        <button id="logoutBtn" class="btn-secondary">Sair</button>
      </div>
    `;

    // Mostrar denúncias recebidas
    const denuncias = JSON.parse(localStorage.getItem('denuncias') || '[]');
    const minhasDenuncias = denuncias.filter(d => d.postoId === currentUser.id);

    html += `
      <h3>Denúncias Recebidas</h3>
      ${
        minhasDenuncias.length > 0
          ? `<ul class="station-list">
              ${minhasDenuncias.map(d => `
                <li class="route-station-item">
                  <div class="station-info">
                    <b>${d.fuel}</b><br>
                    <span class="muted">Denunciado por: ${d.userEmail}</span><br>
                    <span class="muted">${d.date}</span>
                  </div>
                </li>`).join('')}
            </ul>`
          : `<p class="muted">Nenhuma denúncia recebida até agora.</p>`
      }
    `;
  } 
  else if (currentUser.type === 'user') {
    html += `
      <div class="profile-card">
        <div class="profile-avatar"><i class="fa-solid fa-user"></i></div>
        <div class="profile-info">
          <b>${currentUser.name}</b><br>
          <span class="muted">${currentUser.email}</span>
        </div>
      </div>
      <div class="profile-actions">
        <button id="denounceBtnScreen">Denunciar posto por preços falsos</button>
        <button id="logoutBtn" class="btn-secondary">Sair</button>
      </div>
    `;
  }

  content.innerHTML = html;

  document.getElementById('editPricesBtn')?.addEventListener('click', () => {
    if (currentUser && currentUser.type === 'posto' && currentUser.postoId) {
      // Chama a função que abre a tela de edição
      openEditPricesForPosto(currentUser.postoId);
    } else {
      showToast('Erro: Não foi possível identificar o posto.');
    }
  });

  // Botão sair
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('currentUser');
    showToast('Você saiu da conta');
    hideScreen('screenProfile');
  });

  // Botão de denúncia (abre tela)
  document.getElementById('denounceBtnScreen')?.addEventListener('click', () => {
    hideScreen('screenProfile');

    openDenounceScreen();
  });

  // Redirecionar para cadastro
  document.getElementById('gotoRegisterBtn')?.addEventListener('click', () => {
    hideScreen('screenProfile');
    showScreen('screenRegisterUser');
  });
}  

/* -------------------------
   Helpers / small utilities
   ------------------------- */
function openProfileForPosto(postoId) {
  showScreen('screenProfile');
  renderProfileScreen(postoId);
}
function openEditPricesForPosto(postoId) {
  const posto = gasData.find(s => s.id === postoId);
  if (!posto) return;
  previousScreenId = currentScreenId || null;
  const elName = document.getElementById('editPostoName');
  if (elName) { elName.textContent = posto.name; elName.dataset.postoId = posto.id; }
  document.getElementById('priceGas').value = posto.prices.gas || '';
  document.getElementById('priceEtanol').value = posto.prices.etanol || '';
  document.getElementById('priceDiesel').value = posto.prices.diesel || '';
  if (currentScreenId === 'screenProfile') hideScreen('screenProfile');
  showScreen('screenEditPrices');
}

function toggleQuickMenu() {
  const qm = document.getElementById('quickMenu'); if (!qm) return;
  qm.classList.toggle('hidden'); qm.setAttribute('aria-hidden', qm.classList.contains('hidden') ? 'true' : 'false');
}
function hideQuickMenu() { const qm = document.getElementById('quickMenu'); if (!qm) return; qm.classList.add('hidden'); qm.setAttribute('aria-hidden','true'); }

function setTopbarForMap(isMapVisible) {
  const profileBtn = document.getElementById('profileBtn');
  const searchWrap = document.querySelector('.search-wrap');
  if (profileBtn) profileBtn.style.display = isMapVisible ? '' : 'none';
  if (searchWrap) searchWrap.style.display = isMapVisible ? '' : 'none';
}

function showToast(msg, ms = 2000) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.remove('hidden'); clearTimeout(t._timeout); t._timeout = setTimeout(()=> t.classList.add('hidden'), ms); }

function updateProfileIcon() { const btn = document.getElementById('profileBtn'); if (!btn) return; btn.innerHTML = currentUser ? '<i class="fa-solid fa-user-check"></i>' : '<i class="fa-solid fa-user"></i>'; saveData(); }

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
