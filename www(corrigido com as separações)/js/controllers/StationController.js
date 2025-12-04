class StationController {
    constructor(database) {
        this.database = database;
        this.bestValueStations = [];
        this.stations = [];
    }

    async init() {
        await this.loadStations();
    }

    async loadStations() {
        try {
            this.stations = await Station.findAll();
            console.log(`📊 ${this.stations.length} estações carregadas`);
        } catch (error) {
            console.error('Erro ao carregar estações:', error);
            this.stations = [];
        }
    }


    async calculateBestValueStations() {
        const stations = await Station.findAll();
        
        // Calcular confiabilidade para todas as estações
        stations.forEach(station => {
            station.calculateTrustScore();
            station.save(); // Salvar as alterações no banco
        });
        
        // Encontrar a melhor custo-benefício
        let bestStation = null;
        let bestScore = -Infinity;
        
        stations.forEach(station => {
            if (station.prices?.gas && station.trustScore >= 6.0) {
                const price = parseFloat(station.prices.gas);
                const trust = parseFloat(station.trustScore);
                const valueScore = (10 - price) * trust;
                
                if (valueScore > bestScore) {
                    bestScore = valueScore;
                    bestStation = station;
                }
            }
        });
        
        // Resetar flag anterior
        stations.forEach(station => {
            station.isBestValue = false;
        });
        
        // Marcar o melhor
        if (bestStation) {
            bestStation.isBestValue = true;
            await bestStation.save();
            console.log(`🏆 Melhor custo-benefício: ${bestStation.name}`);
        }
        
        this.bestValueStations = bestStation ? [bestStation] : [];
        return this.bestValueStations;
    }

    async search(query) {
        return this.database.searchStations(query);
    }

    async findNearby(lat, lng, radiusKm = CONFIG.SEARCH_RADIUS_KM) {
        return Station.findNearby(lat, lng, radiusKm);
    }

    async suggestPrice(stationId, fuelType = null) {
        const station = await Station.findById(stationId);
        if (!station) {
            Toast.show('❌ Posto não encontrado');
            return;
        }
        
        // Se não especificou o combustível, perguntar
        if (!fuelType) {
            const selectedFuel = prompt(
                `Qual combustível?\n1 - ${FUEL_NAMES[FUEL_TYPES.GAS]}\n2 - ${FUEL_NAMES[FUEL_TYPES.ETHANOL]}\n3 - ${FUEL_NAMES[FUEL_TYPES.DIESEL]}\n\nDigite 1, 2 ou 3:`
            );
            
            if (!selectedFuel) return;
            
            switch(selectedFuel.trim()) {
                case '1': fuelType = FUEL_TYPES.GAS; break;
                case '2': fuelType = FUEL_TYPES.ETHANOL; break;
                case '3': fuelType = FUEL_TYPES.DIESEL; break;
                default: 
                    Toast.show('❌ Tipo inválido');
                    return;
            }
        }
        
        const currentPrice = station.prices?.[fuelType] || '--';
        const newPrice = prompt(
            `Preço atual do ${FUEL_NAMES[fuelType]}: R$ ${currentPrice}\n\nNovo preço:`
        );
        
        if (!newPrice || isNaN(parseFloat(newPrice))) {
            Toast.show('❌ Preço inválido');
            return;
        }
        
        // Verificar se é o dono do posto
        const auth = window.app?.controllers?.auth;
        if (auth?.isStationOwner() && auth.getCurrentUserStationId() === stationId) {
            // Dono atualiza direto
            station.updatePrice(fuelType, newPrice);
            await station.save();
            
            Toast.show('✅ Preço atualizado com sucesso!');
            return;
        }
        
        // Usuário comum: criar pendência
        const userId = auth?.currentUser?.id || 'anonymous';
        station.addPendingChange(fuelType, newPrice, userId);
        await station.save();
        
        Toast.show('✅ Sugestão enviada — aguarde confirmações da comunidade');
    }

    async confirmPendingPrice(stationId, changeIndex) {
        const station = await Station.findById(stationId);
        if (!station || !station.pendingChanges[changeIndex]) {
            Toast.show('❌ Alteração não encontrada');
            return;
        }
        
        const auth = window.app?.controllers?.auth;
        const userId = auth?.currentUser?.id || 'anonymous';
        
        const result = station.confirmPendingChange(changeIndex, userId);
        
        if (result === 'voted') {
            Toast.show(`👍 Confirmação adicionada! Confiabilidade: ${station.trustScore.toFixed(1)}`);
        } else if (result === 'confirmed') {
            Toast.show('✅ Preço confirmado pela comunidade!');
        } else {
            Toast.show('❌ Você já confirmou este preço');
        }
        
        await station.save();
    }

    async getPendingChangesHtml(station) {
        if (!station.pendingChanges || station.pendingChanges.length === 0) {
            return '';
        }
        
        return station.pendingChanges.map((change, index) => `
            <div class="pending-price-alert">
                <i class="fa-solid fa-clock"></i> 
                <b>${FUEL_NAMES[change.type] || change.type}:</b> R$ ${change.price} 
                (${change.votes}/${CONFIG.MIN_VOTES_TO_CONFIRM} confirmações)
                <br>
                <button class="btn-confirm-price" 
                    onclick="app.controllers.station.confirmPendingPrice('${station.id}', ${index})">
                    Confirmar este preço
                </button>
            </div>
        `).join('');
    }

    async promptUpdatePrice(stationId) {
        const station = await Station.findById(stationId);
        if (!station) return;
        
        const fuelType = prompt(
            `Qual combustível deseja atualizar?\n\n1 - ${FUEL_NAMES[FUEL_TYPES.GAS]}\n2 - ${FUEL_NAMES[FUEL_TYPES.ETHANOL]}\n3 - ${FUEL_NAMES[FUEL_TYPES.DIESEL]}\n\nDigite 1, 2 ou 3:`
        );
        
        if (!fuelType) return;
        
        let selectedFuel;
        switch(fuelType.trim()) {
            case '1': selectedFuel = FUEL_TYPES.GAS; break;
            case '2': selectedFuel = FUEL_TYPES.ETHANOL; break;
            case '3': selectedFuel = FUEL_TYPES.DIESEL; break;
            default: 
                    Toast.show('❌ Tipo inválido');
                    return;
        }
        
        const currentPrice = station.prices?.[selectedFuel] || '--';
        const newPrice = prompt(
            `Preço atual do ${FUEL_NAMES[selectedFuel]}: R$ ${currentPrice}\n\nNovo preço:`
        );
        
        if (!newPrice || isNaN(parseFloat(newPrice))) {
            Toast.show('❌ Preço inválido');
            return;
        }
        
        station.updatePrice(selectedFuel, newPrice);
        await station.save();
        
        Toast.show('✅ Preço atualizado com sucesso!');
    }
}

window.StationController = StationController;