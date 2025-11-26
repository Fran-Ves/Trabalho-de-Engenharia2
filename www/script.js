let map;
let control;
let gasMarkers;
let bestValueStations = [];
let gasData = [];
let users = [];
let currentUser = null;
let tempMarker = null;
let selectingLocationForPosto = false;
let previousScreenId = null;
let currentScreenId = null;

let selectingWaypoints = false;
let tempWaypoints = [];
let tempWayMarkers = [];
let routeFoundStations = [];

let pendingPrices = {};
let certifications = {};
let priceHistory = {};

let currentSortMode = 'price'; // 'price' ou 'trust'

let userLocationMarker = null;
let userAccuracyCircle = null;
let isTrackingLocation = false;
let locationWatchId = null;

let driverMode = false;
let driverStations = [];

let voiceAlertCooldown = {};
let speechSynthesis = window.speechSynthesis;

// INICIALIZAÇÃO PRINCIPAL - APENAS UMA VEZ
document.addEventListener('DOMContentLoaded', async function() {

    console.log('🚀 Iniciando aplicação...');
    
    // Inicializações básicas
    loadData();
    setupUI();
    initMap();
    await loadStationsFromBackend();
    await loadPricesFromBackend();
    renderAllMarkers();

    
    // Configura eventos
    attachEventListeners();
    
    console.log('✅ Aplicação inicializada');
});

/* ========== FUNÇÕES DE UI ========== */
function setupUI() {
    console.log('🎨 Configurando UI...');
    
    // Garante que apenas o mapa esteja visível inicialmente
    hideAllScreens();
    
    // Mostra os botões da home
    const homeQuick = document.getElementById('homeQuick');
    if (homeQuick) {
        homeQuick.classList.remove('hidden');
        console.log('📱 Botões home mostrados');
    }
    
    // Esconde botão voltar inicialmente
    const backBtn = document.getElementById('topbarBackBtn');
    if (backBtn) backBtn.classList.add('hidden');
}

function hideAllScreens() {
    console.log('📺 Escondendo todas as telas...');
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
        screen.setAttribute('aria-hidden', 'true');
    });
}

function showScreen(screenId) {
    console.log('🔄 Mostrando tela:', screenId);
    
    // Esconde todas as telas primeiro
    hideAllScreens();
    
    // Mostra a tela solicitada
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.remove('hidden');
        screen.setAttribute('aria-hidden', 'false');
        
        // Atualiza navegação
        previousScreenId = currentScreenId;
        currentScreenId = screenId;
        
        // Gerencia botão voltar
        const backBtn = document.getElementById('topbarBackBtn');
        if (backBtn) {
            if (screenId === 'main') {
                backBtn.classList.add('hidden');
            } else {
                backBtn.classList.remove('hidden');
            }
        }
        
        console.log('✅ Tela mostrada:', screenId);
    }
}

function hideScreen(screenId) {
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.add('hidden');
        screen.setAttribute('aria-hidden', 'true');
    }
    showScreen('main'); // Volta para o mapa
}

/* ========== EVENT LISTENERS ========== */
function attachEventListeners() {
    console.log('🔗 Anexando event listeners...');
    
    // === BOTÕES PRINCIPAIS DA HOME ===
    const homeBuscar = document.getElementById('homeBuscar');
    const homeTraçar = document.getElementById('homeTraçar');
    const homeCadastrar = document.getElementById('homeCadastrar');
    
    if (homeBuscar) {
        homeBuscar.addEventListener('click', function() {
            console.log('🔍 Botão Buscar clicado');
            document.getElementById('searchInput')?.focus();
        });
    }
    
    if (homeTraçar) {
        homeTraçar.addEventListener('click', function() {
            console.log('🛣️ Botão Traçar Rota clicado');
            startRouteMode();
        });
    }
    
    if (homeCadastrar) {
        homeCadastrar.addEventListener('click', function() {
            console.log('➕ Botão Cadastrar clicado');
            showScreen('screenRegisterPosto');
        });
    }
    
    // === BOTÕES DA TOPBAR ===
    const topbarBackBtn = document.getElementById('topbarBackBtn');
    const profileBtn = document.getElementById('profileBtn');
    const addBtn = document.getElementById('addBtn');
    const locationBtn = document.getElementById('locationBtn'); // ADICIONE ESTA LINHA
    
    if (topbarBackBtn) {
        topbarBackBtn.addEventListener('click', function() {
            console.log('↩️ Botão Voltar clicado');
            if (previousScreenId) {
                showScreen(previousScreenId);
            } else {
                hideAllScreens();
                showScreen('main');
            }
        });
    }
    
    if (profileBtn) {
        profileBtn.addEventListener('click', function() {
            console.log('👤 Botão Perfil clicado');
            showScreen('screenProfile');
            renderProfileScreen();
        });
    }
    
    if (addBtn) {
        addBtn.addEventListener('click', function(ev) {
            ev.stopPropagation();
            console.log('➕ Botão Add clicado');
            showScreen('screenRegisterPosto');
        });
    }
    
    if (locationBtn) {
        locationBtn.addEventListener('click', function() {
            console.log('📍 Botão Localização clicado');
            toggleLocationTracking();
        });
    }
    
    // === BOTÕES DA SIDEBAR ===
    const sidebarClose = document.getElementById('sidebarClose');
    const sbCadastrarPosto = document.getElementById('sbCadastrarPosto');
    const sbTracarRotas = document.getElementById('sbTracarRotas'); // MUDEI O ID AQUI
    
    if (sidebarClose) {
        sidebarClose.addEventListener('click', function() {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.add('hidden');
                adjustHomeButtonsForSidebar(false);
                console.log('🗂️ Sidebar fechada - botões reposicionados');
            }
        });
    }
    
    if (sbCadastrarPosto) {
        sbCadastrarPosto.addEventListener('click', function() {
            showScreen('screenRegisterPosto');
        });
    }
    
    if (sbTracarRotas) {
        sbTracarRotas.addEventListener('click', function() {
            // Fecha a sidebar
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.add('hidden');
                adjustHomeButtonsForSidebar(false);
            }
            
            // Inicia novo traçado de rota
            startRouteMode();
        });
    }
    
    // === BOTÕES DE FORMULÁRIOS ===
    const saveUserBtn = document.getElementById('saveUserScreenBtn');
    const savePostoBtn = document.getElementById('savePostoScreenBtn');
    const loginUserBtn = document.getElementById('loginUserScreenBtn');
    const backFromRouteBtn = document.getElementById('backFromRouteBtn');
    
    if (saveUserBtn) {
        saveUserBtn.addEventListener('click', saveUser);
    }
    
    if (savePostoBtn) {
        savePostoBtn.addEventListener('click', savePosto);
    }
    
    if (loginUserBtn) {
        loginUserBtn.addEventListener('click', handleLogin);
    }
    
    if (backFromRouteBtn) {
        backFromRouteBtn.addEventListener('click', function() {
            hideScreen('screenRoute');
        });
    }
    
    // === SELEÇÃO NO MAPA ===
    const selectOnMapBtn = document.getElementById('selectOnMapScreenBtn');
    if (selectOnMapBtn) {
        selectOnMapBtn.addEventListener('click', function() {
            selectingLocationForPosto = true;
            hideScreen('screenRegisterPosto');
            showToast('📍 Toque no mapa para selecionar a localização do posto');
        });
    }

    const btnLoginUser = document.getElementById('btnLoginUser');
    const btnLoginPosto = document.getElementById('btnLoginPosto');

    if (btnLoginUser) {
        btnLoginUser.addEventListener('click', function() {
            switchLoginForm('user');
        });
    }

	    if (btnLoginPosto) {
	        btnLoginPosto.addEventListener('click', function() {
	            switchLoginForm('posto');
	        });
	    }
	
	    // O botão sbLoginUser não está definido no HTML, removendo a referência para evitar o erro.
	    // const sbLoginUser = document.getElementById('sbLoginUser');
	    // if (sbLoginUser) {
	    //     sbLoginUser.addEventListener('click', function() {
	    //         showScreen('screenLoginUser');
	    //         // Garante que comece com o formulário de usuário
	    //         setTimeout(() => switchLoginForm('user'), 100);
	    //     });
	    // }

    // === CONTROLES DE ORDENAÇÃO NA SIDEBAR ===
    const sortByPrice = document.getElementById('sortByPrice');
    const sortByTrust = document.getElementById('sortByTrust');

    if (sortByPrice) {
        sortByPrice.addEventListener('click', function() {
            currentSortMode = 'price';
            sortByPrice.classList.add('active');
            sortByTrust.classList.remove('active');
            
            // Re-renderiza a lista se houver postos
            if (routeFoundStations.length > 0) {
                renderRouteStationsPanel(routeFoundStations);
            }
        });
    }
    
    if (sortByTrust) {
        sortByTrust.addEventListener('click', function() {
            currentSortMode = 'trust';
            sortByTrust.classList.add('active');
            sortByPrice.classList.remove('active');
            
            // Re-renderiza a lista se houver postos
            if (routeFoundStations.length > 0) {
                renderRouteStationsPanel(routeFoundStations);
            }
        });
    }

    // === FECHAR SIDEBAR E AJUSTAR BOTÕES ===
    if (sidebarClose) {
        sidebarClose.addEventListener('click', function() {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.add('hidden');
                adjustHomeButtonsForSidebar(false);
            }
	        });
	    }
	
	    // === FECHAR SIDEBAR E AJUSTAR BOTÕES ===
	    if (sidebarClose) {
	        sidebarClose.addEventListener('click', function() {
	            const sidebar = document.getElementById('sidebar');
	            if (sidebar) {
	                sidebar.classList.add('hidden');
	                adjustHomeButtonsForSidebar(false);
	            }
	        });
	    }
	
	    // === MODO MOTORISTA ===
	    const homeMotorista = document.getElementById('homeMotorista');
	    const exitDriverModeBtn = document.getElementById('exitDriverMode');
	    const stopRouteBtn = document.getElementById('stopRouteBtn');
	    const toggleDriverModeBtn = document.getElementById('toggleDriverMode');
	    
	    if (homeMotorista) {
	        homeMotorista.addEventListener('click', function() {
	            console.log('🚗 Botão Modo Motorista clicado');
	            enterDriverMode();
	        });
	    }
	    
	    // Adicionando listeners diretos para os botões do modo motorista
	    if (exitDriverModeBtn) {
	        exitDriverModeBtn.addEventListener('click', function(e) {
	            e.preventDefault();
	            e.stopPropagation();
	            console.log('❌ Fechando modo motorista (Botão X)...');
	            exitDriverModeHandler();
	        });
	    }
	
	    if (stopRouteBtn) {
	        stopRouteBtn.addEventListener('click', function(e) {
	            e.preventDefault();
	            e.stopPropagation();
	            console.log('🛑 Parando rota (Botão Parar Rota)...');
	            stopCurrentRoute();
	        });
	    }
	
	    if (toggleDriverModeBtn) {
	        toggleDriverModeBtn.addEventListener('click', function(e) {
	            e.preventDefault();
	            e.stopPropagation();
	            console.log('🚪 Saindo do modo motorista (Botão Sair do Modo)...');
	            exitDriverModeHandler();
	        });
	    }
	    
	    // === EVENTOS DE CLICK DELEGADOS (para elementos que podem ser criados dinamicamente) ===
	    document.addEventListener('click', function(e) {
	        // Outros eventos de click delegados...
	    });
	    
	    console.log(`🔁 Alternado para formulário de: ${type}`);
	}

/* ========== FUNÇÕES DO MAPA ========== */
function initMap() {
    console.log('🗺️ Inicializando mapa...');
    
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('❌ Container do mapa não encontrado');
        return;
    }
    
    // Posição padrão (caso não tenha localização)
    const defaultCoords = [-7.076944, -41.466944];
    
    // Cria o mapa
    map = L.map('map').setView(defaultCoords, 13);
    
    // Adiciona tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Inicializa layer group para marcadores
    gasMarkers = L.layerGroup().addTo(map);
    
    // INICIALIZAÇÃO CORRETA DO CONTROLE DE ROTA (ADICIONE ESTE BLOCO)
    control = L.Routing.control({
        router: L.Routing.osrmv1({ 
            serviceUrl: 'https://router.project-osrm.org/route/v1' 
        }),
        waypoints: [],
        routeWhileDragging: true,
        fitSelectedRoutes: true,
        showAlternatives: false,
        altLineOptions: {
            styles: [
                {color: 'black', opacity: 15, weight: 9},
                {color: 'white', opacity: 0.8, weight: 6},
                {color: 'blue', opacity: 0.5, weight: 2}
            ]
        },
        lineOptions: {
            styles: [
                {color: 'black', opacity: 0.15, weight: 9},
                {color: 'white', opacity: 0.8, weight: 6},
                {color: 'blue', opacity: 0.5, weight: 2}
            ]
        },
        show: false,
        addWaypoints: false,
        routeWhileDragging: true,
        draggableWaypoints: false,
        fitSelectedRoutes: true
    }).addTo(map);

    // EVENTO ROUTESFOUND - MANTENHA APENAS ESTE (REMOVA O DUPLICADO)
    control.on('routesfound', function(e) {
        const routes = e.routes;
        const route = routes[0];
        console.log('🛣️ Rota encontrada');
        
        if (route && route.coordinates) {
            // 1. Encontra os postos na rota
            const coords = route.coordinates; 
            routeFoundStations = findStationsAlongRoute(coords);
            
            // 2. Atualiza a lista lateral
            renderRouteStationsPanel(routeFoundStations);
            
            // 3. ATUALIZA O MAPA
            if (gasMarkers) {
                gasMarkers.clearLayers();
                
                routeFoundStations.forEach(station => {
                    const marker = L.circleMarker(station.coords, {
                        radius: 12,
                        color: '#388E3C',
                        fillColor: '#4CAF50',
                        fillOpacity: 0.9,
                        weight: 3
                    }).addTo(gasMarkers);
                    
                    const popupContent = `
                        <div style="font-weight: bold; margin-bottom: 8px;">${escapeHtml(station.name)}</div>
                        <div style="color:green; font-weight:bold; font-size:11px;">NA SUA ROTA</div>
                        <div>Gasolina: R$ ${station.prices?.gas || '--'}</div>
                    `;
                    marker.bindPopup(popupContent);
                });
            }
            
            showToast(`📍 ${routeFoundStations.length} postos encontrados num raio de 50m`);
            
            // 4. PERGUNTA SE QUER ATIVAR MODO MOTORISTA
            if (routeFoundStations.length > 0) {
                setTimeout(() => {
                    if (confirm(`Encontramos ${routeFoundStations.length} postos na sua rota! Deseja ativar o modo motorista?`)) {
                        enterDriverMode();
                    }
                }, 1000);
            }
        }
    });
    
    // Tenta obter a localização do usuário para posição inicial
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const userCoords = [position.coords.latitude, position.coords.longitude];
                map.setView(userCoords, 15);
                console.log('📍 Mapa iniciado na localização do usuário');
            },
            function() {
                // Usa posição padrão se não conseguir localização
                map.setView(defaultCoords, 13);
                console.log('📍 Mapa iniciado na posição padrão');
            },
            { timeout: 3000 }
        );
    } else {
        map.setView(defaultCoords, 13);
    }
    
    // Evento de clique no mapa
    map.on('click', function(e) {
        if (selectingWaypoints) {
            handleRoutePointSelection(e);
        } else if (selectingLocationForPosto) {
            handleLocationSelection(e);
        }
    });
    
    // Adiciona alguns postos de exemplo para teste
    addSampleStations();
    
    console.log('✅ Mapa inicializado');
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
    
    // Primeiro obtém a localização atual rapidamente
    navigator.geolocation.getCurrentPosition(
        function(position) {
            updateUserLocation(position);
            
            // Agora inicia o watch para atualizações contínuas
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
            enableHighAccuracy: false, // Mais rápido para primeira obtenção
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
    
    // Remove o marcador e círculo de precisão
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

function updateUserLocation(position) {
    const userCoords = [position.coords.latitude, position.coords.longitude];
    const accuracy = position.coords.accuracy;
    
    console.log('📍 Nova localização:', userCoords, 'Precisão:', accuracy + 'm');
    
    // Remove marcadores anteriores
    if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
    }
    if (userAccuracyCircle) {
        map.removeLayer(userAccuracyCircle);
    }
    
    // Cria marcador da localização do usuário
    userLocationMarker = L.marker(userCoords, {
        icon: L.divIcon({
            className: 'user-location-marker',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        }),
        zIndexOffset: 1000
    }).addTo(map);
    
    // Adiciona círculo de precisão
    userAccuracyCircle = L.circle(userCoords, {
        radius: accuracy,
        color: '#1976d2',
        fillColor: '#1976d2',
        fillOpacity: 0.1,
        weight: 1
    }).addTo(map);
    
    // Centraliza o mapa na localização do usuário (apenas se modo motorista ativo)
    if (driverMode) {
        map.setView(userCoords, Math.max(15, map.getZoom()));
    }
    
    // Adiciona efeito de pulso
    addLocationPulse(userCoords);
    
    // Atualiza distâncias no modo motorista
    if (driverMode) {
        updateDriverDistances();
        // VERIFICA ALERTAS DE PROXIMIDADE
        checkProximityAlerts();
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

function startRouteMode() {
    console.log('🛣️ Iniciando modo rota...');
    
    // Se já estiver no modo motorista, sai primeiro
    if (driverMode) {
        exitDriverMode();
    }
    
    // Fecha sidebar se estiver aberta
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.add('hidden');
        adjustHomeButtonsForSidebar(false);
    }
    
    selectingWaypoints = true;
    tempWaypoints = [];
    
    // Limpa marcadores anteriores
    tempWayMarkers.forEach(marker => map.removeLayer(marker));
    tempWayMarkers = [];
    
    showToast('📍 Selecione dois pontos no mapa para traçar a rota');
}

function handleRoutePointSelection(e) {
    const marker = L.marker(e.latlng).addTo(map);
    tempWayMarkers.push(marker);
    tempWaypoints.push(e.latlng); // Mudança importante: usar objeto LatLng em vez de array
    
    console.log(`📍 Ponto ${tempWaypoints.length} selecionado:`, e.latlng);
    
    if (tempWaypoints.length === 2) {
        selectingWaypoints = false;
        
        try {
            // CORREÇÃO: Usar os objetos LatLng diretamente
            control.setWaypoints(tempWaypoints);
            showToast('🗺️ Traçando rota...');
        } catch (err) {
            console.error('Erro ao traçar rota:', err);
            showToast('❌ Erro ao traçar rota');
        }
    }
}
function handleLocationSelection(e) {
    if (tempMarker) {
        map.removeLayer(tempMarker);
    }
    
    tempMarker = L.marker(e.latlng, { draggable: true }).addTo(map);
    selectingLocationForPosto = false;
    
    const locInfo = document.getElementById('locInfoScreen');
    if (locInfo) {
        locInfo.textContent = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
    }
    
    showScreen('screenRegisterPosto');
    showToast('✅ Local selecionado');
}

/* ========== FUNÇÕES DE DADOS ========== */
async function loadData() {
    
    /* já carregado no DOMContentLoaded */

    // gasData = await fetchStationsBackend();    
    try { users = JSON.parse(localStorage.getItem('users') || '[]'); } catch(e) { users = []; }
    try { currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch(e) { currentUser = null; }
    try { pendingPrices = JSON.parse(localStorage.getItem('pendingPrices') || '{}'); } catch(e) { pendingPrices = {}; }
    try { certifications = JSON.parse(localStorage.getItem('certifications') || '{}'); } catch(e) { certifications = {}; }
    try { priceHistory = JSON.parse(localStorage.getItem('priceHistory') || '{}'); } catch(e) { priceHistory = {}; }
    
    console.log('📊 Dados carregados:', { 
        stations: gasData.length, 
        users: users.length,
        currentUser: !!currentUser 
    });
}

function saveData() {
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    localStorage.setItem('pendingPrices', JSON.stringify(pendingPrices));
    localStorage.setItem('certifications', JSON.stringify(certifications));
    localStorage.setItem('priceHistory', JSON.stringify(priceHistory));
}

// function addSampleStations() {
//     // Adiciona alguns postos de exemplo se não houver dados
//     if (gasData.length === 0) {
//         const sampleStations = [
//             {
//                 id: 'sample_1',
//                 name: 'Posto Shell',
//                 coords: [-7.076944, -41.466944],
//                 prices: { gas: 5.89, etanol: 4.20, diesel: 4.95 }
//             },
//             {
//                 id: 'sample_2', 
//                 name: 'Posto Ipiranga',
//                 coords: [-7.080, -41.470],
//                 prices: { gas: 5.75, etanol: 4.15, diesel: 4.85 }
//             }
//         ];
        
//         gasData.push(...sampleStations);
//         saveData();
//         renderAllMarkers();
        
//         console.log('📝 Postos de exemplo adicionados');
//     }
// }

/* ========== FUNÇÕES DE RENDERIZAÇÃO ========== */
function renderAllMarkers() {
    if (!gasMarkers) return;
    gasMarkers.clearLayers();

    // 1. Calcula o Trust Score e identifica o Melhor Custo-Benefício (RF02)
    calculateTrustAndBestValue();

    gasData.forEach(station => {
        if (!station.coords) return;

        // Define a cor baseada no status
        let color = '#1976d2'; // Azul padrão
        let className = '';
        let radius = 10;

        // RF02: Se for o melhor custo-benefício, ganha destaque especial
        if (station.isBestValue) {
            color = '#00c853'; // Verde forte
            className = 'marker-best-value'; // Classe do CSS que pulsa
            radius = 14; // Maior
        }

        const marker = L.circleMarker(station.coords, {
            radius: radius,
            color: color,
            fillColor: color,
            fillOpacity: 0.8,
            weight: 2,
            className: className // Aplica a animação CSS
        }).addTo(gasMarkers);

        // RF01: Monta o HTML do Popup com verificação
        let verifiedBadge = station.isVerified 
            ? `<span class="verified-badge"><i class="fa-solid fa-check-circle"></i> Verificado</span>` 
            : '';

        let pendingHtml = '';
        if (station.pendingChanges && station.pendingChanges.length > 0) {
            const p = station.pendingChanges[0];
            pendingHtml = `
                <div class="pending-price-alert">
                    <i class="fa-solid fa-triangle-exclamation"></i> Alguém informou <b>R$ ${p.price}</b> na Gasolina.
                    <br>
                    <button class="btn-confirm-price" onclick="confirmPrice('${station.id}', 0)">Confirmar é verdade</button>
                </div>
            `;
        }

        const popupContent = `
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">
                ${escapeHtml(station.name)} ${station.isBestValue ? '⭐' : ''}
            </div>
            <div style="font-size:11px; color:#666; margin-bottom:8px;">
                Confiabilidade: <b>${station.trustScore || 5.0}/10</b>
                ${station.isVerified ? '<span class="verified-badge"><i class="fa-solid fa-check-circle"></i> Verificado</span>' : ''}
            </div>
            
            <div style="border-top:1px solid #eee; padding-top:4px;">
                <div>Gasolina: <b>R$ ${station.prices?.gas || '--'}</b> 
                    <small style="color:#1976d2; cursor:pointer;" onclick="promptNewPrice('${station.id}', 'gas')">↻</small>
                </div>
                <div>Etanol: <b>R$ ${station.prices?.etanol || '--'}</b>
                    <small style="color:#1976d2; cursor:pointer;" onclick="promptNewPrice('${station.id}', 'etanol')">↻</small>
                </div>
                <div>Diesel: <b>R$ ${station.prices?.diesel || '--'}</b>
                    <small style="color:#1976d2; cursor:pointer;" onclick="promptNewPrice('${station.id}', 'diesel')">↻</small>
                </div>
            </div>

            ${getPendingChangesHtml(station)}
            
            <div style="margin-top:8px; text-align:center;">
                <small style="color:#1976d2; cursor:pointer;" onclick="promptNewPrice('${station.id}')">Sugerir Novo Preço</small>
            </div>
        `;
        marker.bindPopup(popupContent);
    });

    console.log('📍 Marcadores renderizados com RF01 e RF02');
}

function getPendingChangesHtml(station) {
    if (!station.pendingChanges || station.pendingChanges.length === 0) return '';

    return station.pendingChanges.map((change, index) => `
        <div class="pending-price-alert">
            <i class="fa-solid fa-clock"></i> 
            <b>${getFuelName(change.type)}:</b> R$ ${change.price} 
            (${change.votes}/3 confirmações)
            <br>
            <button class="btn-confirm-price" onclick="confirmPrice('${station.id}', ${index})">
                Confirmar este preço
            </button>
        </div>
    `).join('');
}

function renderRouteStationsPanel(stations) {
    const sidebar = document.getElementById('sidebar');
    const list = document.getElementById('routeSidebarList');
    const info = document.getElementById('routeInfoCompact');
    
    if (!sidebar || !list || !info) return;
    
    // Ordena os postos conforme o modo selecionado
    let sortedStations = [...stations];
    if (currentSortMode === 'price') {
        sortedStations.sort((a, b) => {
            const priceA = a.prices?.gas ? parseFloat(a.prices.gas) : Infinity;
            const priceB = b.prices?.gas ? parseFloat(b.prices.gas) : Infinity;
            return priceA - priceB;
        });
    } else {
        sortedStations.sort((a, b) => {
            const trustA = parseFloat(a.trustScore) || 0;
            const trustB = parseFloat(b.trustScore) || 0;
            return trustB - trustA;
        });
    }
    
    list.innerHTML = '';
    
    if (sortedStations.length === 0) {
        info.textContent = 'Nenhum posto na rota';
        list.innerHTML = '<li><span class="name">Nenhum posto encontrado</span></li>';
    } else {
        info.textContent = `${sortedStations.length} postos na rota (${currentSortMode === 'price' ? 'por preço' : 'por confiança'})`;
        
        sortedStations.forEach(station => {
            const li = document.createElement('li');
            if (station.isBestValue) {
                li.classList.add('station-best');
            }
            
            li.innerHTML = `
                <div>
                    <span class="name">${escapeHtml(station.name)}</span>
                    <span class="trust">${station.trustScore || '5.0'}/10</span>
                </div>
                <span class="price">R$ ${station.prices?.gas || '--'}</span>
            `;
            
            // Adiciona clique para focar no posto no mapa
            li.addEventListener('click', function() {
                if (station.coords) {
                    map.setView(station.coords, 16);
                    // Fecha o popup se estiver aberto
                    map.closePopup();
                    // Aqui você pode abrir o popup do marcador se quiser
                }
            });
            
            list.appendChild(li);
        });
    }
    
    // Mostra a sidebar e ajusta os botões home
    sidebar.classList.remove('hidden');
    adjustHomeButtonsForSidebar(true);
    
    // Garante que a sidebar tenha scroll se necessário
    setTimeout(() => {
        const sidebarContent = sidebar.querySelector('.sidebar-section');
        if (sidebarContent && sidebarContent.scrollHeight > sidebarContent.clientHeight) {
            console.log('📜 Sidebar com scroll ativado');
        }
    }, 100);
}

function adjustHomeButtonsForSidebar(sidebarOpen) {
    const homeQuick = document.getElementById('homeQuick');
    if (homeQuick) {
        if (sidebarOpen) {
            homeQuick.classList.add('sidebar-open');
            console.log('📐 Botões movidos para evitar sobreposição com sidebar');
        } else {
            homeQuick.classList.remove('sidebar-open');
            console.log('📐 Botões retornaram à posição normal');
        }
    }
}

// Certifique-se de que esta função seja chamada ao abrir ou fechar a sidebar
const sidebarClose = document.getElementById('sidebarClose');
if (sidebarClose) {
    sidebarClose.addEventListener('click', function() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.add('hidden');
            adjustHomeButtonsForSidebar(false); // Ajusta os botões ao fechar a sidebar
        }
    });
}

const sidebarOpen = document.getElementById('sidebarOpen'); // Adicione um botão para abrir a sidebar, se necessário
if (sidebarOpen) {
    sidebarOpen.addEventListener('click', function() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.remove('hidden');
            adjustHomeButtonsForSidebar(true); // Ajusta os botões ao abrir a sidebar
        }
    });
}

function renderProfileScreen() {
    const content = document.getElementById('profileContentScreen');
    if (!content) return;
    
    let html = '';
    
    if (!currentUser) {
        html = `
            <div style="text-align:center; padding: 20px;">
                <i class="fa-solid fa-circle-user" style="font-size: 48px; color:#ccc;"></i>
                <p>Você não está logado.</p>
                <div class="actions" style="flex-direction: column;">
                    <button class="big-btn" style="background:#1976d2" onclick="showScreen('screenLoginUser')">Fazer Login</button>
                    <button class="btn-secondary" onclick="showScreen('screenRegisterUser')">Criar Conta Motorista</button>
                    <button class="btn-secondary" onclick="showScreen('screenRegisterPosto')">Cadastrar meu Posto</button>
                </div>
            </div>
        `;
    } else {
        // Verifica se é Posto ou Motorista
        const isPosto = currentUser.type === 'posto';
        const icon = isPosto ? 'fa-gas-pump' : 'fa-user';
        const subtitle = isPosto ? `CNPJ: ${currentUser.cnpj}` : currentUser.email;
        const color = isPosto ? '#e65100' : '#1976d2'; // Laranja para posto, Azul para user
        
        html = `
            <div class="profile-card">
                <div class="profile-avatar" style="color: ${color}; background: ${isPosto ? '#fff3e0' : '#eef2f7'}">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <div class="profile-info">
                    <b style="font-size:16px;">${currentUser.name}</b><br>
                    <span class="muted" style="font-size:12px;">${subtitle}</span>
                    <br>
                    <span style="font-size:10px; background:${color}; color:white; padding:2px 6px; border-radius:4px;">
                        ${isPosto ? 'CONTA EMPRESARIAL' : 'MOTORISTA'}
                    </span>
                </div>
            </div>
            
            <div class="profile-actions" style="flex-direction: column; margin-top:20px;">
                ${isPosto ? 
                    `<button class="big-btn" style="background:#e65100" onclick="promptNewPrice('${currentUser.id}')">
                        <i class="fa-solid fa-tag"></i> Atualizar Meus Preços
                     </button>` 
                    : 
                    `<button onclick="showToast('Histórico em breve...')">Ver Histórico</button>`
                }
                
                <button class="btn-secondary" onclick="logout()" style="margin-top:10px;">Sair da Conta</button>
            </div>
        `;
    }
    
    content.innerHTML = html;
}

/* ========== FUNÇÕES DE NEGÓCIO ========== */
function findStationsAlongRoute(routeCoords) {
  console.log('📐 Calculando postos próximos à rota (raio 50m)...');
  console.log('Quantidade de pontos na geometria da rota:', routeCoords.length);

  // 1. Normaliza as coordenadas da rota para garantir que são objetos L.LatLng válidos
  // O Leaflet Routing Machine geralmente retorna objetos, não arrays simples.
  const routePoints = routeCoords.map(c => {
      // Se já for um objeto com lat/lng
      if (c.lat !== undefined && c.lng !== undefined) {
          return L.latLng(c.lat, c.lng);
      }
      // Se for um array [lat, lng]
      return L.latLng(c[0], c[1]);
  });

  // 2. Filtra os postos
  return gasData.filter(station => {
      if (!station.coords) return false;
      
      const stationLoc = L.latLng(station.coords[0], station.coords[1]);
      let isNear = false;

      // Otimização: Primeiro checa se o posto está muito longe da rota inteira (Bounding Box simples)
      // para não rodar a matemática pesada desnecessariamente, mas para 50m vamos direto ao ponto.

      // Verifica a distância do posto para CADA segmento da rota
      for (let i = 0; i < routePoints.length - 1; i++) {
          const p1 = routePoints[i];
          const p2 = routePoints[i+1];
          
          // Calcula distância geométrica do Ponto até o Segmento de Linha (p1-p2) em metros
          const dist = getDistanceFromPointToSegment(stationLoc, p1, p2);
          
          if (dist <= 50) { // 50 metros
              // Console log para debug (opcional: verifique o console F12 se não aparecer nada)
              // console.log(`✅ Posto ${station.name} está a ${dist.toFixed(1)}m da rota.`);
              isNear = true;
              break; // Se encontrou um segmento perto, não precisa testar o resto da rota para este posto
          }
      }
      
      return isNear;
  });
}

function calculateBestValueStations() {
    return gasData.slice(0, 2); // Simplificado para demonstração
}

async function saveUser() {
    const name = document.getElementById('userNameScreen')?.value;
    const email = document.getElementById('userEmailScreen')?.value;
    const password = document.getElementById('userPassScreen')?.value;
    
    if (!name || !email || !password) {
        showToast('❌ Preencha todos os campos');
        return;
    }
    
    const newUser = {
        id: 'user_' + Date.now(),
        name: name,
        email: email,
        password: password,
        type: 'user'
    };
    
    await fetch("http://localhost:3000/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newUser)
    });

    showToast('✅ Usuário cadastrado com sucesso!');
    hideScreen('screenRegisterUser');
}

async function savePosto() {
    const name = document.getElementById('postoNameScreen')?.value;
    const cnpj = document.getElementById('postoCnpjScreen')?.value;
    // Vamos usar o campo de senha do formulário (precisa existir no HTML)
    // Se não tiver um input específico, use um prompt provisório ou adicione o input no HTML
    const password = document.getElementById('postoPassScreen')?.value || prompt("Defina uma senha para este posto:");
    
    let coords = null;
    if (tempMarker) {
        const latLng = tempMarker.getLatLng();
        coords = [latLng.lat, latLng.lng];
    }
    
    if (!name || !coords || !password) {
        showToast('❌ Nome, Localização e Senha são obrigatórios');
        return;
    }
    
    const newPosto = {
        id: 'posto_' + Date.now(),
        name: name,
        cnpj: cnpj,
        password: password, // AGORA SALVAMOS A SENHA
        coords: coords,
        type: 'posto',      // Identifica que é um posto
        prices: { gas: null, etanol: null, diesel: null },
        isVerified: true,   // O dono do posto é verificado por padrão
        trustScore: 10      // Posto oficial começa com nota máxima
    };
    
    await createStationBackend(newPosto);
    await fetch("http://localhost:3000/api/stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPosto)
    });
    gasData = await fetchStationsBackend();
    renderAllMarkers();
    showToast('✅ Posto cadastrado! Agora você pode fazer login.');
    hideScreen('screenRegisterPosto');
    
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }
}

async function handleLogin() {
    // Verifica qual formulário está ativo
    const userFields = document.getElementById('loginUserFields');
    const isUserForm = !userFields.classList.contains('hidden');
    
    let credentials, foundEntity;

    if (isUserForm) {
        // Login de usuário (motorista)
        const emailInput = document.getElementById('loginEmailScreen')?.value;
        const passwordInput = document.getElementById('loginPassScreen')?.value;

        if (!emailInput || !passwordInput) {
            showToast('❌ Preencha e-mail e senha');
            return;
        }

        credentials = { email: emailInput, password: passwordInput };
        const res = await fetch("http://localhost:3000/api/login/user", { 
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(credentials)
        });
        const result = await res.json();
        foundEntity = result.success ? result.user : null;
        
    } else {
        // Login de posto
        const nameInput = document.getElementById('loginPostoNameScreen')?.value;
        const cnpjInput = document.getElementById('loginPostoCnpjScreen')?.value;

        if (!nameInput || !cnpjInput) {
            showToast('❌ Preencha nome e CNPJ do posto');
            return;
        }

        credentials = { name: nameInput, cnpj: cnpjInput };
        const res = await fetch("http://localhost:3000/api/login/posto", { 
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(credentials)
        });
        const result = await res.json();
        foundEntity = result.success ? result.posto : null;
    }

    if (foundEntity) {
        currentUser = foundEntity;
        
        // Garante que o tipo está definido corretamente
        if (!currentUser.type) {
            currentUser.type = foundEntity.cnpj ? 'posto' : 'user';
        }
        
        saveData();
        updateProfileIcon();
        
        const welcomeName = currentUser.type === 'posto' ? currentUser.name : currentUser.name.split(' ')[0];
        showToast(`✅ Bem-vindo, ${welcomeName}!`);
        
        hideScreen('screenLoginUser');
        
        // Se for posto, pergunta se quer editar preços
        if (currentUser.type === 'posto') {
            setTimeout(() => {
                if(confirm("Deseja atualizar os preços do seu posto agora?")) {
                    promptNewPrice(currentUser.id); 
                }
            }, 500);
        }

    } else {
        showToast('❌ Credenciais inválidas');
    }
}
function logout() {
    currentUser = null;
    saveData();
    updateProfileIcon();
    showToast('👋 Você saiu da conta');
    hideScreen('screenProfile');
}

function updateProfileIcon() {
    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
        if (currentUser) {
            profileBtn.innerHTML = '<i class="fa-solid fa-user-check"></i>';
        } else {
            profileBtn.innerHTML = '<i class="fa-solid fa-user"></i>';
        }
    }
}

function calculateTrustAndBestValue() {
    let bestStation = null;
    let bestScore = -1;
  
    gasData.forEach(station => {
        // FATORES DA NOTA DE CONFIABILIDADE (0-10)
        let score = 5.0; // Nota base
        
        // 1. Posto verificado oficialmente (+3 pontos)
        if (station.isVerified) score += 3.0;
        
        // 2. Histórico de preços estáveis (+1 ponto)
        if (station.priceHistory && Object.keys(station.priceHistory).length > 5) {
            score += 1.0;
        }
        
        // 3. Sem pendências de preço (+1 ponto)
        if (!station.pendingChanges || station.pendingChanges.length === 0) {
            score += 1.0;
        }
        
        // 4. Preços competitivos (+0.5 ponto se gasolina < R$ 6.00)
        if (station.prices?.gas && parseFloat(station.prices.gas) < 6.00) {
            score += 0.5;
        }
        
        // 5. Múltiplos combustíveis com preço (+0.5 ponto)
        const fuelCount = Object.keys(station.prices || {}).filter(k => station.prices[k]).length;
        if (fuelCount >= 2) score += 0.5;
        
        // Limita a nota máxima
        station.trustScore = Math.min(10, score).toFixed(1);
        
        // Reseta flags anteriores
        station.isBestValue = false;
        
        // CALCULA SCORE PARA MELHOR CUSTO-BENEFÍCIO
        // Combina preço baixo com alta confiabilidade
        if (station.prices?.gas && station.trustScore >= 6.0) {
            const price = parseFloat(station.prices.gas);
            const trust = parseFloat(station.trustScore);
            
            // Fórmula: (10 - preço) * confiabilidade
            const valueScore = (10 - price) * trust;
            
            if (valueScore > bestScore) {
                bestScore = valueScore;
                bestStation = station;
            }
        }
    });
  
    // Marca o melhor custo-benefício
    if (bestStation) {
        bestStation.isBestValue = true;
        console.log(`🏆 Melhor custo-benefício: ${bestStation.name} (Score: ${bestScore.toFixed(1)})`);
    }
  }

// RF01: Usuário sugere um novo preço (Entra como pendente)
window.promptNewPrice = async function(stationId, fuelType = null) {
    const station = gasData.find(s => s.id === stationId);
    if (!station) return;

    // Se não especificou o combustível, pergunta qual
    if (!fuelType) {
        const selectedFuel = prompt("Qual combustível?\n1 - Gasolina\n2 - Etanol\n3 - Diesel\n\nDigite 1, 2 ou 3:");
        if (!selectedFuel) return;
        
        switch(selectedFuel.trim()) {
            case '1': fuelType = 'gas'; break;
            case '2': fuelType = 'etanol'; break;
            case '3': fuelType = 'diesel'; break;
            default: 
                showToast('❌ Tipo inválido');
                return;
        }
    }

    const currentPrice = station.prices?.[fuelType] || '--';
    const newPrice = prompt(`Preço atual do ${getFuelName(fuelType)}: R$ ${currentPrice}\n\nNovo preço:`);
    
    if (!newPrice || isNaN(parseFloat(newPrice))) {
        showToast('❌ Preço inválido');
        return;
    }

    // Se é o dono do posto, atualiza direto
    if (currentUser && currentUser.type === 'posto' && currentUser.id === stationId) {
        if (!station.prices) station.prices = {};
        await updatePriceBackend(station.id, { gas, etanol, diesel });
        station.prices[fuelType] = parseFloat(newPrice).toFixed(2);
        station.isVerified = true;
        station.trustScore = 10; // Posto oficial mantém nota máxima
        saveData();
        renderAllMarkers();
        showToast("✅ Preço atualizado com sucesso!");
        return;
    }

    // Usuário comum: cria pendência
    handlePriceSuggestion(stationId, fuelType, newPrice);
};

// FUNÇÃO AUXILIAR: Nome do combustível
function getFuelName(fuelType) {
    const names = {
        'gas': 'Gasolina',
        'etanol': 'Etanol', 
        'diesel': 'Diesel'
    };
    return names[fuelType] || fuelType;
}

// NOVA FUNÇÃO: Gerencia sugestões de preço
function handlePriceSuggestion(stationId, fuelType, newPrice) {
    const station = gasData.find(s => s.id === stationId);
    if (!station) return;

    if (!station.pendingChanges) station.pendingChanges = [];
    
    // Verifica se já existe pendência para este combustível
    const existingChangeIndex = station.pendingChanges.findIndex(
        change => change.type === fuelType
    );

    if (existingChangeIndex >= 0) {
        // Adiciona voto à pendência existente
        const change = station.pendingChanges[existingChangeIndex];
        if (!change.users.includes(currentUser?.id)) {
            change.votes += 1;
            change.users.push(currentUser?.id || 'anonymous');
            
            // AUMENTA A CONFIABILIDADE a cada confirmação
            station.trustScore = Math.min(10, (parseFloat(station.trustScore) || 5) + 0.5);
            
            showToast(`👍 Voto adicionado! Confiabilidade: ${station.trustScore}`);
            
            // Se atingiu 3 votos, aplica automaticamente
            if (change.votes >= 3) {
                applyPriceChange(station, fuelType, change.price);
                station.pendingChanges.splice(existingChangeIndex, 1);
                station.isVerified = true;
                showToast("✅ Preço confirmado pela comunidade!");
            }
        } else {
            showToast("❌ Você já votou neste preço");
        }
    } else {
        // Cria nova pendência
        station.pendingChanges.push({
            type: fuelType,
            price: parseFloat(newPrice).toFixed(2),
            votes: 1,
            users: [currentUser?.id || 'anonymous'],
            timestamp: new Date().toISOString()
        });
        
        station.isVerified = false;
        showToast("⚠️ Preço sugerido! Aguardando confirmações...");
    }

    saveData();
    renderAllMarkers();
}

// RF01: Validação Colaborativa (Segundo usuário confirma)
window.confirmPrice = function(stationId, changeIndex) {
    const station = gasData.find(s => s.id === stationId);
    if (!station || !station.pendingChanges || !station.pendingChanges[changeIndex]) return;

    const change = station.pendingChanges[changeIndex];
    const currentUserId = currentUser?.id || 'anonymous';

    // Verifica se usuário já votou
    if (change.users.includes(currentUserId)) {
        showToast("❌ Você já confirmou este preço");
        return;
    }

    // Adiciona voto
    change.votes += 1;
    change.users.push(currentUserId);
    
    // AUMENTA CONFIABILIDADE a cada confirmação
    station.trustScore = Math.min(10, (parseFloat(station.trustScore) || 5) + 0.5);
    
    showToast(`👍 Confirmação adicionada! Confiabilidade: ${station.trustScore}`);

    // Se atingiu 3 votos, aplica a mudança automaticamente
    if (change.votes >= 3) {
        applyPriceChange(station, change.type, change.price);
        station.pendingChanges.splice(changeIndex, 1);
        station.isVerified = true;
        showToast("✅ Preço confirmado pela comunidade!");
    }

    saveData();
    renderAllMarkers();
};

// NOVA FUNÇÃO: Aplica mudança de preço
function applyPriceChange(station, fuelType, price) {
    if (!station.prices) station.prices = {};
    station.prices[fuelType] = price;
    
    // Bônus de confiabilidade por preço confirmado
    station.trustScore = Math.min(10, (parseFloat(station.trustScore) || 5) + 1);
}

/* ========== FUNÇÕES UTILITÁRIAS ========== */
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, duration);
    
    console.log('💬 Toast:', message);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getDistanceFromPointToSegment(p, a, b) {
  // p, a, b são objetos L.latLng ou {lat, lng}
  let pLat = p.lat, pLng = p.lng;
  let aLat = a.lat, aLng = a.lng;
  let bLat = b.lat, bLng = b.lng;

  // Vetores
  let x = pLat - aLat;
  let y = pLng - aLng;
  let dx = bLat - aLat;
  let dy = bLng - aLng;

  let dot = x * dx + y * dy;
  let len_sq = dx * dx + dy * dy;
  let param = -1;

  if (len_sq !== 0) // Evita divisão por zero
      param = dot / len_sq;

  let xx, yy;

  if (param < 0) {
      xx = aLat;
      yy = aLng;
  } else if (param > 1) {
      xx = bLat;
      yy = bLng;
  } else {
      xx = aLat + param * dx;
      yy = aLng + param * dy;
  }

  // Usa a função nativa do Leaflet para converter a distância lat/lng em Metros
  return map.distance(L.latLng(pLat, pLng), L.latLng(xx, yy));
}

// FUNÇÕES DO MODO MOTORISTA
function enterDriverMode() {
    console.log('🚗 Entrando no modo motorista...');
    
    if (routeFoundStations.length === 0) {
        showToast('⚠️ Trace uma rota primeiro para usar o modo motorista');
        return;
    }
    
    driverMode = true;
    document.body.classList.add('driver-mode-active');
    
    // Esconde elementos da interface
    const topbar = document.getElementById('topbar');
    const homeQuick = document.getElementById('homeQuick');
    const sidebar = document.getElementById('sidebar');
    
    if (topbar) topbar.style.display = 'none';
    if (homeQuick) homeQuick.style.display = 'none';
    if (sidebar) sidebar.classList.add('hidden');
    
    // Reset cooldown de alertas
    voiceAlertCooldown = {};
    
    // Inicializa a síntese de voz
    if (speechSynthesis) {
        // Força o carregamento das vozes disponíveis
        speechSynthesis.getVoices();
    }
    
    // Mensagem de boas-vindas por voz
    setTimeout(() => {
        speakAlert("Modo motorista ativado. Você será avisado quando estiver próximo de postos de gasolina.");
    }, 1000);
    
    // Seleciona os 2 melhores postos para mostrar
    selectDriverStations();
    
    // Mostra o painel do modo motorista
    const driverPanel = document.getElementById('driverModePanel');
    if (driverPanel) {
        driverPanel.classList.remove('hidden');
    }
    
    // Ajusta o visual do mapa para modo motorista
    adjustMapForDriverMode();
    
    showToast('🚗 Modo motorista ativado - Alertas de voz ativos!');
}

function exitDriverModeHandler() {
    console.log('🚗 Executando saída do modo motorista...');
    
    driverMode = false;
    document.body.classList.remove('driver-mode-active');
    
    // Para qualquer alerta de voz em andamento
    if (speechSynthesis) {
        speechSynthesis.cancel();
    }
    
    // Esconde o painel do modo motorista
    const driverPanel = document.getElementById('driverModePanel');
    if (driverPanel) {
        driverPanel.classList.add('hidden');
        console.log('✅ Painel escondido');
    }
    
    // RESTAURA ELEMENTOS DA INTERFACE CORRETAMENTE
    const topbar = document.getElementById('topbar');
    const homeQuick = document.getElementById('homeQuick');
    
    if (topbar) {
        topbar.style.display = 'flex';
        console.log('✅ Topbar restaurada');
    }
    
    if (homeQuick) {
        homeQuick.style.display = 'block';
        // CORREÇÃO CRÍTICA: Remove qualquer deslocamento residual
        homeQuick.style.right = '20px';
        homeQuick.style.transform = 'none';
        homeQuick.classList.remove('sidebar-open');
        console.log('✅ Botões home reposicionados');
    }
    
    // Restaura o mapa
    restoreMapFromDriverMode();
    
    // FORÇA UM REDRAW PARA GARANTIR QUE OS BOTÕES VOLTEM AO LUGAR
    setTimeout(() => {
        if (homeQuick) {
            homeQuick.style.display = 'none';
            setTimeout(() => {
                homeQuick.style.display = 'block';
            }, 10);
        }
    }, 100);
    
    showToast('👋 Modo motorista desativado');
}
function toggleDriverModeHandler() {
    if (driverMode) {
        exitDriverMode();
    } else {
        enterDriverMode();
    }
}

function stopCurrentRoute() {
    console.log('🛑 Parando rota atual...');
    
    // Remove a rota do controle
    if (control) {
        control.setWaypoints([]);
    }
    
    // Limpa variáveis
    routeFoundStations = [];
    tempWaypoints = [];
    tempWayMarkers.forEach(marker => {
        if (marker && map.hasLayer(marker)) {
            map.removeLayer(marker);
        }
    });
    tempWayMarkers = [];
    driverStations = [];
    
    // Fecha a sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.add('hidden');
        adjustHomeButtonsForSidebar(false);
    }
    
    // SAI DO MODO MOTORISTA E RESTAURA BOTÕES
    if (driverMode) {
        exitDriverModeHandler();
    } else {
        // Se não estava no modo motorista, ainda assim garante que os botões estejam no lugar certo
        const homeQuick = document.getElementById('homeQuick');
        if (homeQuick) {
            homeQuick.style.right = '20px';
            homeQuick.style.transform = 'none';
            homeQuick.classList.remove('sidebar-open');
        }
    }
    
    // Restaura todos os marcadores
    renderAllMarkers();
    
    showToast('🗺️ Rota removida - Você pode traçar uma nova');
}

function selectDriverStations() {
    // Seleciona os 2 melhores postos baseado em confiabilidade + preço + distância
    if (routeFoundStations.length === 0) return;
    
    // Ordena por uma combinação de fatores
    const sortedStations = [...routeFoundStations].sort((a, b) => {
        const trustA = parseFloat(a.trustScore) || 0;
        const trustB = parseFloat(b.trustScore) || 0;
        const priceA = a.prices?.gas ? parseFloat(a.prices.gas) : Infinity;
        const priceB = b.prices?.gas ? parseFloat(b.prices.gas) : Infinity;
        
        // Calcula distância se tiver localização do usuário
        let distA = Infinity;
        let distB = Infinity;
        
        if (userLocationMarker) {
            const userLatLng = userLocationMarker.getLatLng();
            if (a.coords) {
                distA = map.distance(userLatLng, L.latLng(a.coords[0], a.coords[1]));
            }
            if (b.coords) {
                distB = map.distance(userLatLng, L.latLng(b.coords[0], b.coords[1]));
            }
        }
        
        // Fórmula de score: (confiabilidade * 2) - (preço * 10) - (distância / 1000)
        const scoreA = (trustA * 2) - (priceA * 10) - (distA / 1000);
        const scoreB = (trustB * 2) - (priceB * 10) - (distB / 1000);
        
        return scoreB - scoreA; // Maior score primeiro
    });
    
    driverStations = sortedStations.slice(0, 2);
    updateDriverPanel();
    
    // Destaca os postos selecionados no mapa
    highlightDriverStationsOnMap();
    
    console.log('⭐ Postos selecionados para modo motorista:', driverStations.map(s => s.name));
}

function updateDriverPanel() {
    const stationCards = document.querySelectorAll('.driver-station-card');
    
    driverStations.forEach((station, index) => {
        if (index < stationCards.length) {
            const card = stationCards[index];
            const distance = calculateDistanceToUser(station);
            
            card.querySelector('.station-name').textContent = station.name.length > 15 ? 
                station.name.substring(0, 15) + '...' : station.name;
            card.querySelector('.station-price').textContent = `R$ ${station.prices?.gas || '--'}`;
            card.querySelector('.station-trust').textContent = `${station.trustScore || '5.0'}/10`;
            card.querySelector('.station-distance').textContent = distance ? `${distance} km` : '-- km';
            
            // Adiciona destaque visual para o melhor posto
            if (index === 0 && driverStations.length > 1) {
                card.style.borderColor = '#f59e0b';
                card.style.background = 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)';
            }
            
            // Adiciona clique para focar no posto
            card.onclick = () => {
                if (station.coords) {
                    map.setView(station.coords, 16);
                    showToast(`📍 Focado em ${station.name}`);
                }
            };
        }
    });
    
    // Preenche cards vazios se não houver postos suficientes
    for (let i = driverStations.length; i < stationCards.length; i++) {
        const card = stationCards[i];
        card.querySelector('.station-name').textContent = 'Nenhum posto';
        card.querySelector('.station-price').textContent = 'R$ --';
        card.querySelector('.station-trust').textContent = '--/10';
        card.querySelector('.station-distance').textContent = '-- km';
        card.onclick = null;
        card.style.borderColor = '#e2e8f0';
        card.style.background = 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)';
    }
}
function calculateDistanceToUser(station) {
    if (!userLocationMarker || !station.coords) return null;
    
    const userLatLng = userLocationMarker.getLatLng();
    const stationLatLng = L.latLng(station.coords[0], station.coords[1]);
    const distanceMeters = map.distance(userLatLng, stationLatLng);
    const distanceKm = (distanceMeters / 1000).toFixed(1);
    
    return distanceKm;
}

function highlightDriverStationsOnMap() {
    // Remove destaque anterior de todos os marcadores
    if (gasMarkers) {
        gasMarkers.clearLayers();
    }
    
    // Adiciona apenas os postos da rota, destacando os do modo motorista
    routeFoundStations.forEach(station => {
        const isDriverStation = driverStations.some(ds => ds.id === station.id);
        
        const marker = L.circleMarker(station.coords, {
            radius: isDriverStation ? 16 : 10,
            color: isDriverStation ? '#f59e0b' : '#388E3C',
            fillColor: isDriverStation ? '#fbbf24' : '#4CAF50',
            fillOpacity: 0.9,
            weight: isDriverStation ? 4 : 2
        }).addTo(gasMarkers);
        
        const popupContent = `
            <div style="font-weight: bold; margin-bottom: 8px;">${escapeHtml(station.name)}</div>
            ${isDriverStation ? '<div style="color:#f59e0b; font-weight:bold; font-size:11px;">⭐ MODO MOTORISTA</div>' : ''}
            <div>Gasolina: R$ ${station.prices?.gas || '--'}</div>
            <div>Confiabilidade: ${station.trustScore || '5.0'}/10</div>
        `;
        marker.bindPopup(popupContent);
        
        if (isDriverStation) {
            marker.openPopup();
        }
    });
}

function adjustMapForDriverMode() {
    console.log('🗺️ Ajustando mapa para modo motorista...');
    
    // Remove controles desnecessários do mapa
    const zoomControl = document.querySelector('.leaflet-control-zoom');
    if (zoomControl) {
        zoomControl.style.display = 'none';
    }
    
    // Ajusta o zoom para mostrar melhor a rota e postos
    if (routeFoundStations.length > 0 && driverStations.length > 0) {
        const bounds = new L.LatLngBounds();
        
        // Adiciona os postos do modo motorista
        driverStations.forEach(station => {
            if (station.coords) {
                bounds.extend(station.coords);
            }
        });
        
        // Adiciona a localização do usuário se disponível
        if (userLocationMarker) {
            bounds.extend(userLocationMarker.getLatLng());
        }
        
        // Adiciona os waypoints da rota
        tempWaypoints.forEach(waypoint => {
            bounds.extend(waypoint);
        });
        
        if (bounds.isValid()) {
            map.fitBounds(bounds, { 
                padding: [50, 50],
                maxZoom: 15
            });
        }
    }
    
    // Aumenta ligeiramente o zoom para melhor visualização
    setTimeout(() => {
        if (map.getZoom() > 13) {
            map.setZoom(map.getZoom() - 1);
        }
    }, 500);
}

function restoreMapFromDriverMode() {
    console.log('🗺️ Restaurando mapa do modo motorista...');
    
    // Restaura controles do mapa
    const zoomControl = document.querySelector('.leaflet-control-zoom');
    if (zoomControl) {
        zoomControl.style.display = 'block';
    }
    
    // Restaura todos os marcadores
    renderAllMarkers();
}

function updateDriverDistances() {
    if (!driverMode || driverStations.length === 0) return;
    
    let needsUpdate = false;
    
    driverStations.forEach(station => {
        const newDistance = calculateDistanceToUser(station);
        if (newDistance) {
            // Atualiza apenas se a distância mudou significativamente
            const currentDistance = station.currentDistance;
            if (!currentDistance || Math.abs(currentDistance - newDistance) > 0.1) {
                station.currentDistance = newDistance;
                needsUpdate = true;
            }
            
            // Adiciona classe visual quando estiver próximo
            const card = document.querySelector(`.driver-station-card:nth-child(${driverStations.indexOf(station) + 1})`);
            if (card) {
                if (newDistance <= 0.1) { // 100 metros
                    card.classList.add('nearby');
                } else {
                    card.classList.remove('nearby');
                }
            }
        }
    });
    
    if (needsUpdate) {
        updateDriverPanel();
    }
}

function checkProximityAlerts() {
    if (!driverMode || !userLocationMarker || driverStations.length === 0) return;

    const userCoords = userLocationMarker.getLatLng();

    driverStations.forEach(station => {
        const stationLatLng = L.latLng(station.coords[0], station.coords[1]);
        const distance = map.distance(userCoords, stationLatLng);

        // Se já alertou recentemente, ignora
        if (voiceAlertCooldown[station.id] && (Date.now() - voiceAlertCooldown[station.id]) < 120000) {
            return;
        }

        // Limite de distância: 20 metros
        if (distance <= 20) {
            speak(`Atenção! Você está a ${Math.round(distance)} metros do posto recomendado: ${station.name}`);
            voiceAlertCooldown[station.id] = Date.now();
        }
    });
}

function initLocationTracking() {
    console.log('📍 Inicializando serviço de localização...');
    
    // Verifica se há permissão anterior
    if (localStorage.getItem('locationTracking') === 'true') {
        setTimeout(() => startLocationTracking(), 1000);
    }
}

/* ========== FUNÇÕES DE AVISO POR VOZ ========== */
function speakAlert(message) {
    // Verifica se a API de síntese de voz está disponível
    if (!speechSynthesis) {
        console.log('❌ API de síntese de voz não disponível');
        return;
    }
    
    // Cancela qualquer fala anterior para evitar sobreposição
    speechSynthesis.cancel();
    
    try {
        const utterance = new SpeechSynthesisUtterance(message);
        
        // Configurações da voz
        utterance.rate = 1.0;    // Velocidade
        utterance.pitch = 1.0;   // Tom
        utterance.volume = 0.8;  // Volume
        
        // Tenta usar voz em português
        const voices = speechSynthesis.getVoices();
        const portugueseVoice = voices.find(voice => 
            voice.lang.includes('pt') || voice.lang.includes('PT')
        );
        
        if (portugueseVoice) {
            utterance.voice = portugueseVoice;
        }
        
        utterance.onerror = function(event) {
            console.error('❌ Erro na síntese de voz:', event);
        };
        
        speechSynthesis.speak(utterance);
        console.log('🗣️ Alerta de voz:', message);
        
    } catch (error) {
        console.error('❌ Erro ao falar:', error);
        // Fallback: mostrar toast
        showToast(`🔊 ${message}`);
    }
}

function checkProximityAlerts() {
    if (!driverMode || !userLocationMarker) return;
    
    const userLatLng = userLocationMarker.getLatLng();
    const alertDistance = 20; // metros
    
    routeFoundStations.forEach(station => {
        if (!station.coords) return;
        
        const stationLatLng = L.latLng(station.coords[0], station.coords[1]);
        const distance = map.distance(userLatLng, stationLatLng);
        
        // Verifica se está dentro da distância de alerta
        if (distance <= alertDistance) {
            // Verifica cooldown (evita alertas repetidos)
            const now = Date.now();
            const lastAlert = voiceAlertCooldown[station.id] || 0;
            const cooldownTime = 30000; // 30 segundos
            
            if (now - lastAlert > cooldownTime) {
                // Atualiza cooldown
                voiceAlertCooldown[station.id] = now;
                
                // Gera alerta de voz
                const fuelPrice = station.prices?.gas ? `R$ ${station.prices.gas}` : 'preço não informado';
                const message = `Posto ${station.name} a ${Math.round(distance)} metros. Gasolina: ${fuelPrice}`;
                
                speakAlert(message);
                
                // Também mostra alerta visual
                showToast(`📍 ${station.name} - ${Math.round(distance)}m`, 5000);
            }
        }
    });
}

function speak(text) {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'pt-BR';
    window.speechSynthesis.speak(utter);
}