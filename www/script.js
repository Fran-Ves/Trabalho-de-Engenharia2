/*
  script.js (versão 2023)
  - reescrito para suporte a múltiplas telas (full-screen) em vez de sheets
  - melhorias na seleção de localização e traçar rotas
  - código mais modular e limpo
*/

// Ajustes para abrir telas (full-screen) em vez de sheets:
// - screenRegisterUser, screenRegisterPosto, screenProfile
// - seleção de localização: esconder tela e permitir clique no mapa, depois reabrir

let map;
let gasMarkers;
let gasData = [];
let users = [];
let currentUser = null;
let tempMarker = null;
let selectingLocationForPosto = false;
let returnScreenId = null; // quando selecionar local, para qual screen voltar
let previousScreenId = null; // guarda tela anterior ao abrir screenEditPrices

let selectingWaypoints = false;
let tempWaypoints = [];
let tempWayMarkers = [];
let routeLayer = null;

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
   Map init (igual)
   ------------------------- */
function initMap() {
  map = L.map('map', { zoomControl: true }).setView([-8.0578, -34.8822], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  gasMarkers = L.layerGroup().addTo(map);

  map.on('click', (e) => {
    if (selectingWaypoints) {
      const m = L.marker(e.latlng).addTo(map);
      tempWayMarkers.push(m);
      tempWaypoints.push([e.latlng.lat, e.latlng.lng]);
      if (tempWaypoints.length === 2) {
        if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
        routeLayer = L.polyline(tempWaypoints, { color: '#1976d2', weight: 5, opacity: 0.9 }).addTo(map);
        map.fitBounds(L.latLngBounds(tempWaypoints).pad(0.2));
        selectingWaypoints = false;
        tempWaypoints = [];
        tempWayMarkers.forEach(x => map.removeLayer(x));
        tempWayMarkers = [];
        showToast('Rota desenhada');
      } else {
        showToast('Ponto 1 registrado. Selecione o ponto 2.');
      }
      hideQuickMenu();
      return;
    }

    if (selectingLocationForPosto) {
      if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
      tempMarker = L.marker(e.latlng, { draggable: true }).addTo(map);
      // volta para a tela que solicitou a seleção
      selectingLocationForPosto = false;
      if (returnScreenId) showScreen(returnScreenId);
      // atualiza campo de localização na tela (se existir)
      const el = document.getElementById('locInfoScreen') || document.getElementById('locInfo');
      if (el) el.textContent = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
      showToast('Local selecionado. Retorne à tela de cadastro para salvar.');
    }
  });
}

/* -------------------------
   Render marcadores (igual)
   ------------------------- */
function renderAllMarkers(filter = '') {
  gasMarkers.clearLayers();
  const q = (filter || '').trim().toLowerCase();
  gasData.forEach(s => {
    const hasPrice = s.prices && (s.prices.gas || s.prices.etanol || s.prices.diesel);
    const color = hasPrice ? 'red' : '#1976d2';
    const marker = L.circleMarker([s.coords[0], s.coords[1]], { radius: 8, color, fillOpacity: 0.9, weight: 2 }).addTo(gasMarkers);
    const popupHtml = `
      <div style="font-weight:700">${escapeHtml(s.name)}</div>
      <div style="font-size:13px;color:#444">${escapeHtml(s.cnpj || '')}</div>
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
    selectingWaypoints = true;
    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    tempWaypoints = []; tempWayMarkers.forEach(m => map.removeLayer(m)); tempWayMarkers = [];
    showToast('Modo traçar rotas ativado. Selecione 2 pontos no mapa.');
  });

  document.getElementById('profileBtn')?.addEventListener('click', () => { showScreen('screenProfile'); renderProfileScreen(); });

  document.getElementById('searchInput')?.addEventListener('input', (e) => renderAllMarkers(e.target.value));

  // back button in topbar (replaces + while a screen is open)
  document.getElementById('topbarBackBtn')?.addEventListener('click', () => {
    if (currentScreenId) {
      hideScreen(currentScreenId);
      currentScreenId = null;
    }
  });

  // Back buttons inside screens still allowed (they just hide the screen)
  document.getElementById('backFromUser')?.addEventListener('click', () => hideScreen('screenRegisterUser'));
  document.getElementById('backFromPosto')?.addEventListener('click', () => hideScreen('screenRegisterPosto'));
  document.getElementById('backFromProfile')?.addEventListener('click', () => hideScreen('screenProfile'));

  // Save user (screen)
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

  // Posto screen: select location button (hide screen, allow map click)
  document.getElementById('selectOnMapScreenBtn')?.addEventListener('click', () => {
    selectingLocationForPosto = true;
    returnScreenId = 'screenRegisterPosto';
    hideScreen('screenRegisterPosto');
    showToast('Toque no mapa para selecionar a localização do posto');
  });

  // Save posto (screen)
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

  // Edit prices (screen) save / cancel
  document.getElementById('savePricesBtn')?.addEventListener('click', () => {
    const gas = parseFloat(document.getElementById('priceGas').value) || null;
    const etanol = parseFloat(document.getElementById('priceEtanol').value) || null;
    const diesel = parseFloat(document.getElementById('priceDiesel').value) || null;
    const editingPostoId = document.getElementById('editPostoName').dataset.postoId;
    const posto = gasData.find(s => s.id === editingPostoId);
    if (!posto) { showToast('Posto não encontrado'); return; }
    posto.prices = { gas, etanol, diesel };
    saveData();
    renderAllMarkers();
    // fechar edição
    hideScreen('screenEditPrices');
    // se veio do perfil, reabrir perfil; caso contrário, permanecer no mapa
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

// showScreen / hideScreen agora controlam topbar e currentScreenId
function showScreen(id) {
  hideQuickMenu();
  const screen = document.getElementById(id);
  if (!screen) return;
  // exibir screen e ajustar topbar: esconder perfil/busca e trocar + por back
  screen.classList.remove('hidden'); screen.setAttribute('aria-hidden','false');
  currentScreenId = id;
  setTopbarForMap(false);
  // esconder + e exibir back button
  const addBtn = document.getElementById('addBtn'); const topback = document.getElementById('topbarBackBtn');
  if (addBtn) addBtn.style.display = 'none';
  if (topback) topback.classList.remove('hidden');
}
function hideScreen(id) {
  const screen = document.getElementById(id);
  if (!screen) return;
  screen.classList.add('hidden'); screen.setAttribute('aria-hidden','true');
  // verificar se ainda existe alguma screen aberta
  const anyScreenVisible = !!document.querySelector('.screen:not(.hidden)');
  if (!anyScreenVisible) {
    setTopbarForMap(true);
    // restaurar + e esconder back
    const addBtn = document.getElementById('addBtn'); const topback = document.getElementById('topbarBackBtn');
    if (addBtn) addBtn.style.display = '';
    if (topback) topback.classList.add('hidden');
    currentScreenId = null;
  } else {
    // se existe outra screen, ajustar currentScreenId para a que estiver visível
    const vis = document.querySelector('.screen:not(.hidden)');
    currentScreenId = vis ? vis.id : null;
  }
}

// quando perfil pede edição de preços, abrir screenEditPrices (em vez de sheet)
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
    const posto = gasData.find(s => s.id === focusPostoId);
    if (!posto) { container.innerHTML = '<p>Posto não encontrado</p>'; return; }
    container.innerHTML = `
      <div class="profile-card">
        <div class="profile-avatar"><i class="fa-solid fa-gas-pump"></i></div>
        <div class="profile-info">
          <div style="font-weight:700">${escapeHtml(posto.name)}</div>
          <div class="muted">${escapeHtml(posto.cnpj)}</div>
          <div style="margin-top:8px">Preços:
            <div class="muted">Gasolina: ${posto.prices.gas || '--'}</div>
            <div class="muted">Etanol: ${posto.prices.etanol || '--'}</div>
            <div class="muted">Diesel: ${posto.prices.diesel || '--'}</div>
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
    const posto = gasData.find(s => s.id === currentUser.postoId);
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
      // marcar tela anterior como perfil e fechar perfil antes de abrir edição
      previousScreenId = 'screenProfile';
      hideScreen('screenProfile');
      // preenche campos e abre screenEditPrices
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

/* Quick menu helpers */
function toggleQuickMenu() {
  const qm = document.getElementById('quickMenu'); if (!qm) return;
  qm.classList.toggle('hidden'); qm.setAttribute('aria-hidden', qm.classList.contains('hidden') ? 'true' : 'false');
}
function hideQuickMenu() { const qm = document.getElementById('quickMenu'); if (!qm) return; qm.classList.add('hidden'); qm.setAttribute('aria-hidden','true'); }

/* -------------------------
   Topbar visibility helpers
   ------------------------- */
// Esconde ou mostra elementos da barra superior (perfil e busca) dependendo se o mapa está ativo.
function setTopbarForMap(isMapVisible) {
  const profileBtn = document.getElementById('profileBtn');
  const searchWrap = document.querySelector('.search-wrap');
  if (profileBtn) profileBtn.style.display = isMapVisible ? '' : 'none';
  if (searchWrap) searchWrap.style.display = isMapVisible ? '' : 'none';
}

/* Screens show/hide */
function showScreen(id) {
  hideQuickMenu();
  const screen = document.getElementById(id);
  if (!screen) return;
  // exibir screen e ajustar topbar: esconder perfil/busca e trocar + por back
  screen.classList.remove('hidden'); screen.setAttribute('aria-hidden','false');
  currentScreenId = id;
  setTopbarForMap(false);
  // esconder + e exibir back button
  const addBtn = document.getElementById('addBtn'); const topback = document.getElementById('topbarBackBtn');
  if (addBtn) addBtn.style.display = 'none';
  if (topback) topback.classList.remove('hidden');
}
function hideScreen(id) {
  const screen = document.getElementById(id);
  if (!screen) return;
  screen.classList.add('hidden'); screen.setAttribute('aria-hidden','true');
  // verificar se ainda existe alguma screen aberta
  const anyScreenVisible = !!document.querySelector('.screen:not(.hidden)');
  if (!anyScreenVisible) {
    setTopbarForMap(true);
    // restaurar + e esconder back
    const addBtn = document.getElementById('addBtn'); const topback = document.getElementById('topbarBackBtn');
    if (addBtn) addBtn.style.display = '';
    if (topback) topback.classList.add('hidden');
    currentScreenId = null;
  } else {
    // se existe outra screen, ajustar currentScreenId para a que estiver visível
    const vis = document.querySelector('.screen:not(.hidden)');
    currentScreenId = vis ? vis.id : null;
  }
}

// quando perfil pede edição de preços, abrir screenEditPrices (em vez de sheet)
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
    const posto = gasData.find(s => s.id === focusPostoId);
    if (!posto) { container.innerHTML = '<p>Posto não encontrado</p>'; return; }
    container.innerHTML = `
      <div class="profile-card">
        <div class="profile-avatar"><i class="fa-solid fa-gas-pump"></i></div>
        <div class="profile-info">
          <div style="font-weight:700">${escapeHtml(posto.name)}</div>
          <div class="muted">${escapeHtml(posto.cnpj)}</div>
          <div style="margin-top:8px">Preços:
            <div class="muted">Gasolina: ${posto.prices.gas || '--'}</div>
            <div class="muted">Etanol: ${posto.prices.etanol || '--'}</div>
            <div class="muted">Diesel: ${posto.prices.diesel || '--'}</div>
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
    const posto = gasData.find(s => s.id === currentUser.postoId);
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
      // marcar tela anterior como perfil e fechar perfil antes de abrir edição
      previousScreenId = 'screenProfile';
      hideScreen('screenProfile');
      // preenche campos e abre screenEditPrices
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

/* Quick menu helpers */
function toggleQuickMenu() {
  const qm = document.getElementById('quickMenu'); if (!qm) return;
  qm.classList.toggle('hidden'); qm.setAttribute('aria-hidden', qm.classList.contains('hidden') ? 'true' : 'false');
}
function hideQuickMenu() { const qm = document.getElementById('quickMenu'); if (!qm) return; qm.classList.add('hidden'); qm.setAttribute('aria-hidden','true'); }

/* -------------------------
   Topbar visibility helpers
   ------------------------- */
// Esconde ou mostra elementos da barra superior (perfil e busca) dependendo se o mapa está ativo.
function setTopbarForMap(isMapVisible) {
  const profileBtn = document.getElementById('profileBtn');
  const searchWrap = document.querySelector('.search-wrap');
  if (profileBtn) profileBtn.style.display = isMapVisible ? '' : 'none';
  if (searchWrap) searchWrap.style.display = isMapVisible ? '' : 'none';
}

/* Screens show/hide */
function showScreen(id) {
  hideQuickMenu();
  const screen = document.getElementById(id);
  if (!screen) return;
  // exibir screen e ajustar topbar: esconder perfil/busca e trocar + por back
  screen.classList.remove('hidden'); screen.setAttribute('aria-hidden','false');
  currentScreenId = id;
  setTopbarForMap(false);
  // esconder + e exibir back button
  const addBtn = document.getElementById('addBtn'); const topback = document.getElementById('topbarBackBtn');
  if (addBtn) addBtn.style.display = 'none';
  if (topback) topback.classList.remove('hidden');
}
function hideScreen(id) {
  const screen = document.getElementById(id);
  if (!screen) return;
  screen.classList.add('hidden'); screen.setAttribute('aria-hidden','true');
  // verificar se ainda existe alguma screen aberta
  const anyScreenVisible = !!document.querySelector('.screen:not(.hidden)');
  if (!anyScreenVisible) {
    setTopbarForMap(true);
    // restaurar + e esconder back
    const addBtn = document.getElementById('addBtn'); const topback = document.getElementById('topbarBackBtn');
    if (addBtn) addBtn.style.display = '';
    if (topback) topback.classList.add('hidden');
    currentScreenId = null;
  } else {
    // se existe outra screen, ajustar currentScreenId para a que estiver visível
    const vis = document.querySelector('.screen:not(.hidden)');
    currentScreenId = vis ? vis.id : null;
  }
}

// quando perfil pede edição de preços, abrir screenEditPrices (em vez de sheet)
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
    const posto = gasData.find(s => s.id === focusPostoId);
    if (!posto) { container.innerHTML = '<p>Posto não encontrado</p>'; return; }
    container.innerHTML = `
      <div class="profile-card">
        <div class="profile-avatar"><i class="fa-solid fa-gas-pump"></i></div>
        <div class="profile-info">
          <div style="font-weight:700">${escapeHtml(posto.name)}</div>
          <div class="muted">${escapeHtml(posto.cnpj)}</div>
          <div style="margin-top:8px">Preços:
            <div class="muted">Gasolina: ${posto.prices.gas || '--'}</div>
            <div class="muted">Etanol: ${posto.prices.etanol || '--'}</div>
            <div class="muted">Diesel: ${posto.prices.diesel || '--'}</div>
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
    const posto = gasData.find(s => s.id === currentUser.postoId);
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
      // marcar tela anterior como perfil e fechar perfil antes de abrir edição
      previousScreenId = 'screenProfile';
      hideScreen('screenProfile');
      // preenche campos e abre screenEditPrices
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

/* other helper functions reused (openProfileForPosto, openEditPricesForPosto, closeEditPrices, etc.) */

function openProfileForPosto(postoId) {
  showScreen('screenProfile'); renderProfileScreen(postoId);
}
function openEditPricesForPosto(postoId) {
  const posto = gasData.find(s => s.id === postoId);
  if (!posto) return;
  // guarda origem: se houver uma screen aberta, voltar para ela depois; caso contrário null
  previousScreenId = currentScreenId || null;
  // preenche campos
  const elName = document.getElementById('editPostoName');
  elName.textContent = posto.name; elName.dataset.postoId = posto.id;
  document.getElementById('priceGas').value = posto.prices.gas || '';
  document.getElementById('priceEtanol').value = posto.prices.etanol || '';
  document.getElementById('priceDiesel').value = posto.prices.diesel || '';
  // se veio do profile, escondemos-o, caso contrário deixamos mapa e abrimos edição
  if (currentScreenId === 'screenProfile') hideScreen('screenProfile');
  showScreen('screenEditPrices');
}
function closeEditPrices() { hideElement('editPricesSheet'); }

function showElement(id) { const el = document.getElementById(id); if (el) { el.classList.remove('hidden'); el.setAttribute('aria-hidden','false'); } }
function hideElement(id) { const el = document.getElementById(id); if (el) { el.classList.add('hidden'); el.setAttribute('aria-hidden','true'); } }

function showToast(msg, ms = 2000) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.remove('hidden'); clearTimeout(t._timeout); t._timeout = setTimeout(()=> t.classList.add('hidden'), ms); }

function updateProfileIcon() { const btn = document.getElementById('profileBtn'); if (!btn) return; btn.innerHTML = currentUser ? '<i class="fa-solid fa-user-check"></i>' : '<i class="fa-solid fa-user"></i>'; saveData(); }

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

/* alterações:
   - adiciona topbarBackBtn behavior (substitui o "+")
   - cria screenEditPrices e garante que edição de preços abre como screen (não sheet)
   - mantém retorno à tela correta ao selecionar localização no mapa
*/