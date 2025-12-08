let map;
let gasMarkers;
let control = null;
let controlInitialized = false;
let userLocationMarker;
let userAccuracyCircle;
let isTrackingLocation = false;
let locationWatchId = null;


function initMap() {
    console.log('🗺️ Inicializando mapa...');
    
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('❌ Container do mapa não encontrado');
        return;
    }
    
    const defaultCoords = [-7.076944, -41.466944];
    
    map = L.map('map').setView(defaultCoords, 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    gasMarkers = L.layerGroup().addTo(map);

    if (mapContainer) {
        mapContainer.setAttribute('tabindex', '-1');
    }
    
    // Inicializar o controle de rotas
    initRoutingControl();
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const userCoords = [position.coords.latitude, position.coords.longitude];
                map.setView(userCoords, 15);
                console.log('📍 Mapa iniciado na localização do usuário');
            },
            function() {
                map.setView(defaultCoords, 13);
                console.log('📍 Mapa iniciado na posição padrão');
            },
            { timeout: 3000 }
        );
    } else {
        map.setView(defaultCoords, 13);
    }
    
    map.on('click', function(e) {
        if (selectingWaypoints) {
            handleRoutePointSelection(e);
        } else if (selectingLocationForPosto) {
            handleLocationSelection(e);
        }
    });

    map.on('layeradd', function(e) {
        if (e.layer instanceof L.CircleMarker) {
            const layerLatLng = e.layer.getLatLng();
            const station = gasData.find(s => 
                s.coords && 
                s.coords[0] === layerLatLng.lat && 
                s.coords[1] === layerLatLng.lng
            );
            
            if (station) {
                e.layer.stationId = station.id;
            }
        }
    });
    
    addSampleStations();
    renderAllMarkers();
    window.map = map;
    
    console.log('✅ Mapa inicializado');
}

function handleLocationSelection(e) {
    if (!selectingLocationForPosto) {
        return;
    }

    console.log('📍 Localização selecionada:', e.latlng);

    // Criar objeto padronizado
    const selected = {
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        coords: [e.latlng.lat, e.latlng.lng]
    };

    // Limpar marcador temporário anterior
    if (tempMarker) {
        try { map.removeLayer(tempMarker); } catch (err) { /* ignore */ }
        tempMarker = null;
    }

    // Adicionar novo marcador temporário
    tempMarker = L.marker(e.latlng, {
        icon: L.divIcon({
            className: 'temp-marker',
            html: '<i class="fa-solid fa-map-pin" style="color: #e53935; font-size: 24px;"></i>',
            iconSize: [24, 24],
            iconAnchor: [12, 24]
        })
    }).addTo(map);

    // VERIFICAÇÃO CORRETA DO CONTEXTO
    const isEditMode = window.locationSelectionContext === 'edit' || 
                     (currentUser && currentUser.type === 'posto' && 
                      !window.fromCadastro);

    console.log('🔍 Modo detectado:', isEditMode ? 'EDIÇÃO' : 'CADASTRO');
    console.log('🔍 Contexto:', window.locationSelectionContext);
    console.log('🔍 fromCadastro:', window.fromCadastro);
    
    if (isEditMode) {
        // MODO EDIÇÃO
        window.tempSelectedLocation = selected;
        
        // Atualizar o campo na tela de edição
        const locInfo = document.getElementById('editPostoLocInfo');
        if (locInfo) {
            locInfo.textContent = `Lat: ${selected.lat.toFixed(5)}, Lng: ${selected.lng.toFixed(5)}`;
            locInfo.style.color = '#1976d2';
            locInfo.style.fontWeight = 'bold';
            locInfo.classList.add('selected');
            locInfo.dataset.lat = selected.lat;
            locInfo.dataset.lng = selected.lng;
        }
        
        // Remover botões específicos da edição - usando a função do escopo global
        removeEditLocationButtons();
        
        // Limpar variável de controle
        selectingLocationForPosto = false;
        window.locationSelectionContext = null;
        window.fromCadastro = false;
        
        // Remover listener do mapa
        if (map._editingLocationListener) {
            map.off('click', onMapClickForEditing);
            map._editingLocationListener = false;
        }
        
        // Voltar para tela de edição
        setTimeout(() => {
            showScreen('screenEditProfile');
            showToast('✅ Localização selecionada! Clique em Salvar para aplicar.');
        }, 300);
    } else {
        // MODO CADASTRO
        selectedLocationForPosto = e.latlng;
        window.fromCadastro = true;
        
        // Atualizar o campo na tela de cadastro
        const locInfo = document.getElementById('locInfoScreen');
        if (locInfo) {
            locInfo.textContent = `Lat: ${selected.lat.toFixed(5)}, Lng: ${selected.lng.toFixed(5)}`;
            locInfo.style.color = '#1976d2';
            locInfo.style.fontWeight = 'bold';
            locInfo.classList.add('selected');
        }
        
        // Remover botões específicos do cadastro
        removeCadastroLocationButtons();
        
        // Limpar variável de controle
        selectingLocationForPosto = false;
        window.locationSelectionContext = null;
        
        // Remover listener do mapa
        if (map._editingLocationListener) {
            map.off('click', onMapClickForEditing);
            map._editingLocationListener = false;
        }
        
        // Voltar para tela de cadastro
        setTimeout(() => {
            showScreen('screenRegisterPosto');
            showToast('✅ Localização selecionada! Complete os outros dados.');
        }, 300);
    }
}

// Funções auxiliares para remover botões
function removeEditLocationButtons() {
    const backBtn = document.getElementById('backToEditProfileBtn');
    if (backBtn) backBtn.remove();
    
    const cancelBtn = document.getElementById('cancelLocationSelectionBtn');
    if (cancelBtn) cancelBtn.remove();
}

function removeCadastroLocationButtons() {
    const backBtn = document.getElementById('backToCadastroBtn');
    if (backBtn) backBtn.remove();
}

function initRoutingControl() {
    try {
        if (!L.Routing || !L.Routing.control) {
            console.error('❌ Leaflet Routing Machine não carregado');
            return null;
        }
        
        control = L.Routing.control({
            router: L.Routing.osrmv1({ 
                serviceUrl: 'https://router.project-osrm.org/route/v1' 
            }),
            waypoints: [],
            routeWhileDragging: true,
            fitSelectedRoutes: true,
            showAlternatives: false,
            lineOptions: {
                styles: [
                    {color: 'black', opacity: 0.15, weight: 9},
                    {color: 'white', opacity: 0.8, weight: 6},
                    {color: 'blue', opacity: 0.5, weight: 2}
                ]
            },
            show: false,
            addWaypoints: false,
            draggableWaypoints: false
        }).addTo(map);
        
        // VERIFICAÇÃO SEGURA: só adiciona event listener se controle foi criado
        if (control) {
            control.on('routesfound', function(e) {
                console.log('🛣️ Rota encontrada no controle');
                handleRoutesFound(e);
            });
            console.log('✅ Controle de rotas inicializado com listener');
        } else {
            console.warn('⚠️ Controle de rotas não foi criado');
        }
        
        return control;
    } catch (error) {
        console.error('❌ Erro ao inicializar controle de rotas:', error);
        showToast('⚠️ Sistema de rotas temporariamente indisponível');
        return null;
    }
}

function stopCurrentRoute() {
    console.log('🛑 Parando rota atual...');
    
    if (control) {
        control.setWaypoints([]);
    }
    
    routeFoundStations = [];
    tempWaypoints = [];
    tempWayMarkers.forEach(marker => {
        if (marker && map.hasLayer(marker)) {
            map.removeLayer(marker);
        }
    });
    tempWayMarkers = [];
    driverStations = [];
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.add('hidden');
        adjustHomeButtonsForSidebar(false);
    }
    
    if (driverMode) {
        exitDriverModeHandler();
    } else {
        const homeQuick = document.getElementById('homeQuick');
        if (homeQuick) {
            homeQuick.style.right = '20px';
            homeQuick.style.transform = 'none';
            homeQuick.classList.remove('sidebar-open');
        }
    }
    
    renderAllMarkers();
    
    showToast('🗺️ Rota removida - Você pode traçar uma nova');
}

function toggleLocationTracking() {
    if (isTrackingLocation) {
        stopLocationTracking();
    } else {
        startLocationTracking();
    }
}

function startLocationTracking() {
    localStorage.setItem('locationTracking', 'true');
    console.log('📍 Iniciando rastreamento de localização...');
    
    const locationBtn = document.getElementById('locationBtn');
    if (locationBtn) {
        locationBtn.classList.add('loading');
    }
    
    if (!navigator.geolocation) {
        showToast('❌ Geolocalização não suportada neste navegador');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            updateUserLocation(position);
            
            locationWatchId = navigator.geolocation.watchPosition(
                updateUserLocation,
                handleLocationError,
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 10000
                }
            );
            
            isTrackingLocation = true;
            if (locationBtn) {
                locationBtn.classList.remove('loading');
                locationBtn.classList.add('active');
            }
            
            showToast('📍 Seguindo sua localização');
        },
        handleLocationError,
        {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 30000
        }
    );
}

function stopLocationTracking() {
    localStorage.setItem('locationTracking', 'false');
    console.log('🛑 Parando rastreamento de localização...');
    
    if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
    }
    
    isTrackingLocation = false;
    
    const locationBtn = document.getElementById('locationBtn');
    if (locationBtn) {
        locationBtn.classList.remove('active', 'loading');
    }
    
    if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
        userLocationMarker = null;
    }
    
    if (userAccuracyCircle) {
        map.removeLayer(userAccuracyCircle);
        userAccuracyCircle = null;
    }
    
    showToast('📍 Parou de seguir localização');
}

function updateUserLocation(position) {
    const userCoords = [position.coords.latitude, position.coords.longitude];
    const accuracy = position.coords.accuracy;
    
    console.log('📍 Nova localização:', userCoords, 'Precisão:', accuracy + 'm');
    
    if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
    }
    if (userAccuracyCircle) {
        map.removeLayer(userAccuracyCircle);
    }
    
    userLocationMarker = L.marker(userCoords, {
        icon: L.divIcon({
            className: 'user-location-marker',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        }),
        zIndexOffset: 1000
    }).addTo(map);
    
    userAccuracyCircle = L.circle(userCoords, {
        radius: accuracy,
        color: '#1976d2',
        fillColor: '#1976d2',
        fillOpacity: 0.1,
        weight: 1
    }).addTo(map);
    
    if (driverMode) {
        map.setView(userCoords, Math.max(15, map.getZoom()));
    }
    
    addLocationPulse(userCoords);
    
    if (driverMode) {
        updateDriverDistances();
        checkProximityAlerts(); // ← Adicione esta linha
    }
}

function addLocationPulse(coords) {
    const pulse = L.circleMarker(coords, {
        radius: 8,
        color: '#1976d2',
        fillColor: '#1976d2',
        fillOpacity: 0.3,
        weight: 2
    }).addTo(map);
    
    setTimeout(() => {
        map.removeLayer(pulse);
    }, 1000);
}

function handleLocationError(error) {
    console.error('❌ Erro de localização:', error);
    
    const locationBtn = document.getElementById('locationBtn');
    if (locationBtn) {
        locationBtn.classList.remove('loading', 'active');
    }
    
    let message = '❌ Erro desconhecido ao obter localização';
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = '❌ Permissão de localização negada. Ative nas configurações.';
            break;
        case error.POSITION_UNAVAILABLE:
            message = '❌ Localização indisponível. Verifique seu GPS.';
            break;
        case error.TIMEOUT:
            message = '❌ Tempo esgotado ao buscar localização.';
            break;
    }
    
    showToast(message);
}

function findNearbyStations() {
    if (!userLocationMarker) {
        showToast('📍 Ative a localização primeiro');
        return;
    }
    
    const userCoords = userLocationMarker.getLatLng();
    const nearbyRadius = 2000; // 2km
    
    const nearbyStations = gasData.filter(station => {
        if (!station.coords) return false;
        
        const stationLatLng = L.latLng(station.coords[0], station.coords[1]);
        const distance = map.distance(userCoords, stationLatLng);
        
        return distance <= nearbyRadius;
    });
    
    if (nearbyStations.length > 0) {
        // Ordena por distância
        nearbyStations.sort((a, b) => {
            const distA = map.distance(userCoords, L.latLng(a.coords[0], a.coords[1]));
            const distB = map.distance(userCoords, L.latLng(b.coords[0], b.coords[1]));
            return distA - distB;
        });
        
        showToast(`📍 ${nearbyStations.length} postos próximos encontrados`);
        
        // Foca no posto mais próximo
        const closestStation = nearbyStations[0];
        map.setView(closestStation.coords, 15);
        
    } else {
        showToast('📍 Nenhum posto encontrado próximo a você');
    }
}
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (isControlValid()) {
            console.log('✅ Controle de rotas verificado e pronto');
        } else {
            console.warn('⚠️ Controle de rotas não está disponível');
        }
    }, 1000);
});

function navigateToStation(stationId, keepMode = true) {
    const station = gasData.find(s => s.id === stationId);
    if (!station || !station.coords) return;
    
    // Para modo motorista, pausa o seguimento temporariamente
    if (driverMode && keepMode) {
        // Adiciona um pequeno destaque visual
        const highlightCircle = L.circle(station.coords, {
            radius: 30,
            color: '#FF9800',
            fillColor: '#FF9800',
            fillOpacity: 0.2,
            weight: 2
        }).addTo(map);
        
        // Remove após alguns segundos
        setTimeout(() => {
            if (highlightCircle && map.hasLayer(highlightCircle)) {
                map.removeLayer(highlightCircle);
            }
        }, 3000);
    }
    
    // Navega para o posto
    map.setView(station.coords, Math.max(map.getZoom(), 16));
    
    // Encontra e abre o popup
    gasMarkers.eachLayer(function(layer) {
        if (layer.stationId === stationId) {
            layer.openPopup();
        }
    });
    
    showToast(`📍 Navegando para: ${station.name}`);
}

function cleanupLocationSelection() {
    // Remover listener
    if (map._editingLocationListener) {
        map.off('click', onMapClickForEditing);
        map._editingLocationListener = false;
    }
    
    // Remover marcador
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }
    
    // Resetar variáveis
    selectingLocationForPosto = false;
    window.locationSelectionContext = null;
    window.fromCadastro = false;
}

function isControlValid() {
    return control && typeof control === 'object' && typeof control.on === 'function';
}

function removeEditLocationButtons() {
    console.log('🗑️ Removendo botões de edição...');
    
    const backBtn = document.getElementById('backToEditProfileBtn');
    const cancelBtn = document.getElementById('cancelLocationSelectionBtn');
    
    if (backBtn) {
        backBtn.remove();
        console.log('✅ backToEditProfileBtn removido');
    } else {
        console.log('⚠️ backToEditProfileBtn não encontrado');
    }
    
    if (cancelBtn) {
        cancelBtn.remove();
        console.log('✅ cancelLocationSelectionBtn removido');
    } else {
        console.log('⚠️ cancelLocationSelectionBtn não encontrado');
    }
}

// Adicione também para cadastro
function removeCadastroLocationButtons() {
    console.log('🗑️ Removendo botões de cadastro...');
    
    const backBtn = document.getElementById('backToCadastroBtn');
    
    if (backBtn) {
        backBtn.remove();
        console.log('✅ backToCadastroBtn removido');
    } else {
        console.log('⚠️ backToCadastroBtn não encontrado');
    }
}

// Torna a função global
window.navigateToStation = navigateToStation;
window.handleLocationSelection = handleLocationSelection;
window.cleanupLocationSelection = cleanupLocationSelection;
if (typeof window.handleLocationSelection === 'undefined') {
    window.handleLocationSelection = handleLocationSelection;
}
window.removeEditLocationButtons = removeEditLocationButtons;
window.removeCadastroLocationButtons = removeCadastroLocationButtons;
window.handleLocationSelection = handleLocationSelection;
window.cleanupLocationSelection = cleanupLocationSelection;

if (typeof window.handleLocationSelection === 'undefined') {
    window.handleLocationSelection = handleLocationSelection;
}