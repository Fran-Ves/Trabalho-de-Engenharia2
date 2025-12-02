function getDistanceFromPointToSegment(P, A, B) {
    function toRad(x) { return x * Math.PI / 180; }
    function haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const φ1 = toRad(lat1);
        const φ2 = toRad(lat2);
        const Δφ = toRad(lat2 - lat1);
        const Δλ = toRad(lon2 - lon1);
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    const AP = [P.lat - A.lat, P.lng - A.lng];
    const AB = [B.lat - A.lat, B.lng - A.lng];
    
    const dot = AP[0] * AB[0] + AP[1] * AB[1];
    const lenSq = AB[0] * AB[0] + AB[1] * AB[1];
    
    const t = Math.max(0, Math.min(1, dot / lenSq));
    
    const closestLat = A.lat + t * AB[0];
    const closestLng = A.lng + t * AB[1];
    
    return haversineDistance(P.lat, P.lng, closestLat, closestLng);
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


function findStationsAlongRoute(routeCoords) {
    console.log('📐 Calculando postos próximos à rota (raio 50m)...');
    
    const routePoints = routeCoords.map(c => {
        if (c.lat !== undefined && c.lng !== undefined) {
            return L.latLng(c.lat, c.lng);
        }
        return L.latLng(c[0], c[1]);
    });
    
    return gasData.filter(station => {
        if (!station.coords) return false;
        
        const stationLoc = L.latLng(station.coords[0], station.coords[1]);
        let isNear = false;
        
        for (let i = 0; i < routePoints.length - 1; i++) {
            const p1 = routePoints[i];
            const p2 = routePoints[i+1];
            
            const dist = getDistanceFromPointToSegment(stationLoc, p1, p2);
            
            if (dist <= 50) {
                isNear = true;
                break;
            }
        }
        
        return isNear;
    });
}

function handleRoutePointSelection(e) {
    const marker = L.marker(e.latlng).addTo(map);
    tempWayMarkers.push(marker);
    tempWaypoints.push(e.latlng);
    
    console.log(`📍 Ponto ${tempWaypoints.length} selecionado:`, e.latlng);
    
    if (tempWaypoints.length === 2) {
        selectingWaypoints = false;
        
        try {
            control.setWaypoints(tempWaypoints);
            showToast('🗺️ Traçando rota...');
        } catch (err) {
            console.error('Erro ao traçar rota:', err);
            showToast('❌ Erro ao traçar rota');
        }
    }
}

function renderRouteStationsPanel(stations) {
    const sidebar = document.getElementById('sidebar');
    const list = document.getElementById('routeSidebarList');
    const info = document.getElementById('routeInfoCompact');
    
    if (!sidebar || !list || !info) return;
    
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
            
            li.addEventListener('click', function() {
                if (station.coords) {
                    map.setView(station.coords, 16);
                    map.closePopup();
                }
            });
            
            list.appendChild(li);
        });
    }
    
    sidebar.classList.remove('hidden');
    adjustHomeButtonsForSidebar(true);
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

function handleLocationSelection(e) {
    if (tempMarker) {
        map.removeLayer(tempMarker);
    }
    
    tempMarker = L.marker(e.latlng, {
        icon: L.divIcon({
            className: 'temp-marker',
            html: '<i class="fa-solid fa-map-pin" style="color: #e53935; font-size: 24px;"></i>',
            iconSize: [24, 24],
            iconAnchor: [12, 24]
        })
    }).addTo(map);
    
    showToast('📍 Localização selecionada! Clique em "Salvar Posto" para finalizar.');
}