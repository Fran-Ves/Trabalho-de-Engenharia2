/* stations.js — render de postos, sugestões e confirmações de preço */
let bestValueStations = [];

function renderAllMarkers() {
    if (!gasMarkers) return;
    gasMarkers.clearLayers();

    calculateTrustAndBestValue();

    gasData.forEach(station => {
        if (!station.coords) return;

        let color = '#1976d2';
        let className = '';
        let radius = 10;

        if (station.isBestValue) {
            color = '#00c853';
            className = 'marker-best-value';
            radius = 14;
        }

        const marker = L.circleMarker(station.coords, {
            radius, color, fillColor: color, fillOpacity: 0.8, weight: 2, className
        }).addTo(gasMarkers);

        marker.stationId = station.id;

        let pendingHtml = '';
        if (station.pendingChanges && station.pendingChanges.length > 0) {
            pendingHtml = getPendingChangesHtml(station);
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

            ${pendingHtml}

            <div style="margin-top:8px; text-align:center;">
                <small style="color:#1976d2; cursor:pointer;" onclick="promptNewPrice('${station.id}')">Sugerir Novo Preço</small>
            </div>
        `;
        marker.bindPopup(popupContent);
    });

    console.log('📍 Marcadores renderizados');
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

window.promptNewPrice = function(stationId, fuelType = null) {
    const station = gasData.find(s => s.id === stationId);
    if (!station) return;

    if (!fuelType) {
        const selectedFuel = prompt("Qual combustível?\n1 - Gasolina\n2 - Etanol\n3 - Diesel\n\nDigite 1, 2 ou 3:");
        if (!selectedFuel) return;
        switch(selectedFuel.trim()) {
            case '1': fuelType = 'gas'; break;
            case '2': fuelType = 'etanol'; break;
            case '3': fuelType = 'diesel'; break;
            default: showToast('❌ Tipo inválido'); return;
        }
    }

    const currentPrice = station.prices?.[fuelType] || '--';
    const newPrice = prompt(`Preço atual do ${getFuelName(fuelType)}: R$ ${currentPrice}\n\nNovo preço:`);

    if (!newPrice || isNaN(parseFloat(newPrice))) {
        showToast('❌ Preço inválido');
        return;
    }

    if (currentUser && currentUser.type === 'posto' && currentUser.id === stationId) {
        if (!station.prices) station.prices = {};
        station.prices[fuelType] = parseFloat(newPrice).toFixed(2);
        station.isVerified = true;
        station.trustScore = 10;
        saveData();
        renderAllMarkers();
        showToast("✅ Preço atualizado com sucesso!");
        return;
    }

    handlePriceSuggestion(stationId, fuelType, parseFloat(newPrice).toFixed(2));
};

async function confirmPrice(stationId, changeIndex) {
  const station = gasData.find(s => s.id === stationId);
  if (!station || !station.pendingChanges || !station.pendingChanges[changeIndex]) return;
  
  const change = station.pendingChanges[changeIndex];
  const currentUserId = currentUser?.id || `anon_${getAnonId()}`;

  if (change.users.includes(currentUserId)) {
    showToast("❌ Você já confirmou este preço");
    return;
  }

  change.votes += 1;
  change.users.push(currentUserId);
  station.trustScore = Math.min(10, (parseFloat(station.trustScore) || 5) + 0.5);
  showToast(`👍 Confirmação adicionada! Confiabilidade: ${station.trustScore}`);

  if (change.votes >= 3) {
    applyPriceChange(station, change.type, change.price);
    station.pendingChanges.splice(changeIndex, 1);
    station.isVerified = true;
    showToast("✅ Preço confirmado pela comunidade!");
  }

  // Atualizar no IndexedDB
  if (typeof dbPut === 'function') {
    await dbPut('stations', station);
  }
  
  await saveData();
  renderAllMarkers();
}

async function handlePriceSuggestion(stationId, fuelType, price) {
  const station = gasData.find(s => s.id === stationId);
  if (!station) return;
  
  if (!station.pendingChanges) station.pendingChanges = [];

  const change = { 
    type: fuelType, 
    price: parseFloat(price).toFixed(2), 
    votes: 1, 
    users: [currentUser?.id || getAnonId()] 
  };
  
  station.pendingChanges.unshift(change);
  
  // Atualizar no IndexedDB se disponível
  if (typeof dbPut === 'function') {
    await dbPut('stations', station);
  }
  
  await saveData();
  renderAllMarkers();
  showToast('✅ Sugestão enviada — aguarde confirmações da comunidade');
}

function applyPriceChange(station, fuelType, price) {
    if (!station.prices) station.prices = {};
    station.prices[fuelType] = parseFloat(price).toFixed(2);
    if (!priceHistory[station.id]) priceHistory[station.id] = [];
    priceHistory[station.id].push({ type: fuelType, price: parseFloat(price), date: Date.now() });
    saveData();
}

function calculateTrustAndBestValue() {
    let bestStation = null;
    let bestScore = -Infinity;

    gasData.forEach(station => {
        let score = 5.0;

        if (station.isVerified) score += 3.0;
        if (station.priceHistory && Object.keys(station.priceHistory).length > 5) score += 1.0;
        if (!station.pendingChanges || station.pendingChanges.length === 0) score += 1.0;
        if (station.prices?.gas && parseFloat(station.prices.gas) < 6.00) score += 0.5;
        const fuelCount = Object.keys(station.prices || {}).filter(k => station.prices[k]).length;
        if (fuelCount >= 2) score += 0.5;

        station.trustScore = Math.min(10, score).toFixed(1);
        station.isBestValue = false;

        if (station.prices?.gas && parseFloat(station.trustScore) >= 6.0) {
            const price = parseFloat(station.prices.gas);
            const trust = parseFloat(station.trustScore);
            const valueScore = (10 - price) * trust;
            if (valueScore > bestScore) {
                bestScore = valueScore;
                bestStation = station;
            }
        }
    });

    if (bestStation) {
        bestStation.isBestValue = true;
        console.log(`🏆 Melhor custo-benefício: ${bestStation.name}`);
    }
}

function getFuelName(fuelType) {
    const names = { 'gas': 'Gasolina', 'etanol': 'Etanol', 'diesel': 'Diesel' };
    return names[fuelType] || fuelType;
}

function getAnonId() {
    let aid = localStorage.getItem('anonId');
    if (!aid) { aid = 'a_' + Date.now(); localStorage.setItem('anonId', aid); }
    return aid;
}

function searchStations(query) {
    if (!query || query.trim() === '') {
        renderAllMarkers(); // Mostra todos se busca vazia
        return [];
    }
    
    const searchTerm = query.toLowerCase().trim();
    
    const filteredStations = gasData.filter(station => {
        return (
            (station.name && station.name.toLowerCase().includes(searchTerm)) ||
            (station.cnpj && station.cnpj.includes(searchTerm))
        );
    });
    
    // Foca no mapa no primeiro resultado
    if (filteredStations.length > 0 && filteredStations[0].coords) {
        map.setView(filteredStations[0].coords, 15);
        
        // Destaca os resultados
        if (gasMarkers) {
            gasMarkers.clearLayers();
            
            filteredStations.forEach(station => {
                const marker = L.circleMarker(station.coords, {
                    radius: 12,
                    color: '#FF9800',
                    fillColor: '#FFB74D',
                    fillOpacity: 0.9,
                    weight: 3
                }).addTo(gasMarkers);
                
                const popupContent = `
                    <div style="font-weight: bold; margin-bottom: 8px;">${escapeHtml(station.name)}</div>
                    <div style="color:#FF9800; font-weight:bold; font-size:11px;">RESULTADO DA BUSCA</div>
                    <div>Gasolina: R$ ${station.prices?.gas || '--'}</div>
                    <div>Confiabilidade: ${station.trustScore || '5.0'}/10</div>
                `;
                marker.bindPopup(popupContent);
                marker.stationId = station.id;
            });
        }
        
        showToast(`🔍 ${filteredStations.length} posto(s) encontrado(s)`);
    } else {
        showToast('❌ Nenhum posto encontrado com essa busca');
    }
    
    return filteredStations;
}

window.searchStations = searchStations;

/* stations.js - Adicione esta função */

function findStationByName(query) {
    if (!query || query.trim() === '') return null;
    
    const searchTerm = query.toLowerCase().trim();
    
    // 1. Busca por correspondência exata (ignorando case)
    const exactMatch = gasData.find(station => 
        station.name && station.name.toLowerCase() === searchTerm
    );
    if (exactMatch) return exactMatch;
    
    // 2. Busca por correspondência parcial
    const partialMatches = gasData.filter(station => 
        station.name && station.name.toLowerCase().includes(searchTerm)
    );
    
    // Retorna o primeiro resultado se houver apenas um
    if (partialMatches.length === 1) return partialMatches[0];
    
    // 3. Retorna null se múltiplos resultados ou nenhum
    return null;
}

// Adiciona ao escopo global
window.findStationByName = findStationByName;