/* drivermode.js — modo motorista e alertas por voz */

function enterDriverMode() {
    console.log('🚗 DEBUG: enterDriverMode chamada');
    console.log('routeFoundStations:', routeFoundStations);
    console.log('driverMode (antes):', driverMode);
    
    if (!routeFoundStations || routeFoundStations.length === 0) {
        console.error('❌ routeFoundStations vazio ou não definido');
        showToast('⚠️ Trace uma rota primeiro para usar o modo motorista');
        return;
    }

    driverMode = true;
    document.body.classList.add('driver-mode-active');

    const topbar = document.getElementById('topbar');
    const homeQuick = document.getElementById('homeQuick');
    const sidebar = document.getElementById('sidebar');
    if (topbar) topbar.style.display = 'none';
    if (homeQuick) homeQuick.style.display = 'none';
    if (sidebar) sidebar.classList.add('hidden');

    voiceAlertCooldown = {};
    if (speechSynthesis) speechSynthesis.getVoices();

    setTimeout(() => speakAlert("Modo motorista ativado. Você será avisado quando estiver próximo de postos de gasolina."), 500);

    selectDriverStations();

    const driverPanel = document.getElementById('driverModePanel');
    if (driverPanel) driverPanel.classList.remove('hidden');

    adjustMapForDriverMode();
    showToast('🚗 Modo motorista ativado - Alertas de voz ativos!');
}

function exitDriverModeHandler() {
    console.log('🚗 Saindo do modo motorista...');
    driverMode = false;
    document.body.classList.remove('driver-mode-active');
    if (speechSynthesis) speechSynthesis.cancel();
    const driverPanel = document.getElementById('driverModePanel');
    if (driverPanel) driverPanel.classList.add('hidden');

    const topbar = document.getElementById('topbar');
    const homeQuick = document.getElementById('homeQuick');
    if (topbar) topbar.style.display = 'flex';
    if (homeQuick) {
        homeQuick.style.display = 'block';
        homeQuick.style.right = '20px';
        homeQuick.style.transform = 'none';
        homeQuick.classList.remove('sidebar-open');
    }

    restoreMapFromDriverMode();
    showToast('👋 Modo motorista desativado');
}

function exitDriverMode() {
    exitDriverModeHandler();
}

function checkProximityAlerts() {
    if (!driverMode || !userLocationMarker || !driverStations || driverStations.length === 0) return;
    const userCoords = userLocationMarker.getLatLng();

    driverStations.forEach(station => {
        const stationLatLng = L.latLng(station.coords[0], station.coords[1]);
        const distance = map.distance(userCoords, stationLatLng);

        if (voiceAlertCooldown[station.id] && (Date.now() - voiceAlertCooldown[station.id]) < 120000) return;

        if (distance <= 20) {
            speakAlert(`Atenção! Você está a ${Math.round(distance)} metros do posto recomendado: ${station.name}`);
            voiceAlertCooldown[station.id] = Date.now();
        }
    });
}

function calculateDistanceToUser(station) {
    if (!userLocationMarker || !station.coords) return null;
    const userCoords = userLocationMarker.getLatLng();
    const stationLatLng = L.latLng(station.coords[0], station.coords[1]);
    const distanceMeters = map.distance(userCoords, stationLatLng);
    return (distanceMeters / 1000).toFixed(2);
}

function updateDriverDistances() {
    if (!driverMode || !driverStations || driverStations.length === 0) return;
    let needsUpdate = false;
    driverStations.forEach((station, idx) => {
        const newDistance = calculateDistanceToUser(station);
        if (newDistance !== null) {
            if (!station.currentDistance || Math.abs(station.currentDistance - newDistance) > 0.01) {
                station.currentDistance = newDistance;
                needsUpdate = true;
            }
        }
    });
    if (needsUpdate) updateDriverPanel();
}

function updateDriverPanel() {
    const panel = document.querySelector('#driverModePanel .driver-stations');
    if (!panel) return;
    panel.innerHTML = '';
    driverStations.forEach(station => {
        const card = document.createElement('div');
        card.className = 'driver-station-card';
        card.innerHTML = `
            <div class="station-info">
                <div class="station-name">${escapeHtml(station.name)}</div>
                <div class="station-distance">${station.currentDistance ? station.currentDistance + ' km' : '-- km'}</div>
            </div>
            <div class="station-price">R$ ${station.prices?.gas || '--'}</div>
            <div class="station-trust">${station.trustScore || '--'}/10</div>
        `;
        
        // CLIQUE PARA FOCAR NO POSTO (mesma lógica)
        card.addEventListener('click', function() {
            navigateToStation(station.id, true); // true = mantém modo motorista
        });
        
        panel.appendChild(card);
    });
}

function selectDriverStations() {
    if (!routeFoundStations || routeFoundStations.length === 0) {
        driverStations = [];
        return;
    }
    const copy = [...routeFoundStations];
    copy.sort((a,b) => {
        const pA = a.prices?.gas ? parseFloat(a.prices.gas) : Infinity;
        const pB = b.prices?.gas ? parseFloat(b.prices.gas) : Infinity;
        const tA = parseFloat(a.trustScore) || 0;
        const tB = parseFloat(b.trustScore) || 0;
        return (tB - tA) || (pA - pB);
    });
    driverStations = copy.slice(0,3);
    updateDriverPanel();
}

function speakAlert(text) {
    if (!('speechSynthesis' in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'pt-BR';
    speechSynthesis.speak(utter);
}

function adjustMapForDriverMode() {
    // placeholder
}

function restoreMapFromDriverMode() {
    // placeholder
}

window.enterDriverMode = enterDriverMode;
window.exitDriverMode = exitDriverMode;
window.exitDriverModeHandler = exitDriverModeHandler;