let map;
let gasMarkers;
let control;
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
        draggableWaypoints: false
    }).addTo(map);

    control.on('routesfound', function(e) {
        const routes = e.routes;
        const route = routes[0];
        console.log('🛣️ Rota encontrada');
        
        if (route && route.coordinates) {
            const coords = route.coordinates; 
            routeFoundStations = findStationsAlongRoute(coords);
            
            renderRouteStationsPanel(routeFoundStations);
            
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
            
            if (routeFoundStations.length > 0) {
                setTimeout(() => {
                    if (confirm(`Encontramos ${routeFoundStations.length} postos na sua rota! Deseja ativar o modo motorista?`)) {
                        enterDriverMode();
                    }
                }, 1000);
            }
        }
    });
    
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
    
    addSampleStations();
    renderAllMarkers();
    
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

map.on('click', function(e) {
    if (selectingWaypoints) {
        handleRoutePointSelection(e);
    } else if (selectingLocationForPosto) {
        handleLocationSelection(e);
    }
});