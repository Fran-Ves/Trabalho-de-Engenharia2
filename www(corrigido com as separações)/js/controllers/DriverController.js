class DriverController {
    constructor(database) {
        this.database = database;
        this.isActive = false;
        this.stations = [];
        this.voiceAlertCooldown = {};
        this.speechSynthesis = window.speechSynthesis;
    }

    async init() {
        // Pré-carregar vozes
        if (this.speechSynthesis) {
            this.speechSynthesis.getVoices();
        }
    }

    enterDriverMode(stations = []) {
        console.log('🚗 Entrando no modo motorista...');
        
        if (stations.length === 0) {
            Toast.show('⚠️ Nenhum posto encontrado na rota');
            return;
        }
        
        this.isActive = true;
        this.stations = stations.slice(0, 3); // Limitar a 3 postos
        this.voiceAlertCooldown = {};
        
        document.body.classList.add('driver-mode-active');
        
        // Esconder elementos da interface
        this.hideInterfaceElements();
        
        // Mostrar painel do modo motorista
        this.showDriverPanel();
        
        // Configurar atualização de distâncias
        this.setupDistanceUpdates();
        
        // Mensagem de boas-vindas por voz
        setTimeout(() => {
            this.speakAlert("Modo motorista ativado. Você será avisado quando estiver próximo de postos de gasolina.");
        }, 1000);
        
        Toast.show('🚗 Modo motorista ativado - Alertas de voz ativos!');
    }

    exitDriverMode() {
        console.log('🚗 Saindo do modo motorista...');
        
        this.isActive = false;
        document.body.classList.remove('driver-mode-active');
        
        // Parar qualquer alerta de voz
        if (this.speechSynthesis) {
            this.speechSynthesis.cancel();
        }
        
        // Esconder painel do modo motorista
        this.hideDriverPanel();
        
        // Mostrar elementos da interface novamente
        this.showInterfaceElements();
        
        // Restaurar mapa
        window.app?.controllers?.map?.loadStations();
        
        Toast.show('👋 Modo motorista desativado');
    }

    hideInterfaceElements() {
        const elementsToHide = ['topbar', 'homeQuick', 'sidebar'];
        elementsToHide.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.classList.add('hidden');
        });
    }

    showInterfaceElements() {
        const elementsToShow = ['topbar', 'homeQuick'];
        elementsToShow.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.classList.remove('hidden');
        });
    }

    showDriverPanel() {
        const panel = document.getElementById('driverModePanel');
        if (panel) {
            panel.classList.remove('hidden');
            this.updateDriverPanel();
        }
    }

    hideDriverPanel() {
        const panel = document.getElementById('driverModePanel');
        if (panel) {
            panel.classList.add('hidden');
        }
    }

    updateDriverPanel() {
        const panel = document.querySelector('#driverModePanel .driver-stations');
        if (!panel) return;
        
        panel.innerHTML = '';
        
        this.stations.forEach(station => {
            const card = document.createElement('div');
            card.className = 'driver-station-card';
            
            // Calcular distância até o usuário
            const distance = this.calculateDistanceToUser(station);
            
            card.innerHTML = `
                <div class="station-info">
                    <div class="station-name">${this.escapeHtml(station.name)}</div>
                    <div class="station-distance">${distance ? distance + ' km' : '-- km'}</div>
                </div>
                <div class="station-price">R$ ${station.prices?.gas || '--'}</div>
                <div class="station-trust">${station.trustScore?.toFixed(1) || '--'}/10</div>
            `;
            
            card.addEventListener('click', () => {
                window.app?.controllers?.map?.navigateToStation(station.id);
            });
            
            panel.appendChild(card);
        });
    }

    setupDistanceUpdates() {
        // Atualizar distâncias a cada 5 segundos
        this.distanceInterval = setInterval(() => {
            this.updateDistances();
            this.checkProximityAlerts();
        }, 5000);
    }

    updateDistances() {
        const userLocation = window.app?.controllers?.map?.userLocation;
        if (!userLocation || !this.isActive) return;
        
        let needsUpdate = false;
        
        this.stations.forEach(station => {
            if (!station.coords) return;
            
            const newDistance = this.calculateDistance(
                userLocation[0], userLocation[1],
                station.coords[0], station.coords[1]
            );
            
            if (!station.currentDistance || 
                Math.abs(station.currentDistance - newDistance) > 0.01) {
                station.currentDistance = newDistance;
                needsUpdate = true;
            }
        });
        
        if (needsUpdate) {
            this.updateDriverPanel();
        }
    }

    calculateDistanceToUser(station) {
        const userLocation = window.app?.controllers?.map?.userLocation;
        if (!userLocation || !station.coords) return null;
        
        return this.calculateDistance(
            userLocation[0], userLocation[1],
            station.coords[0], station.coords[1]
        ).toFixed(2);
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Raio da Terra em km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    toRad(degrees) {
        return degrees * (Math.PI/180);
    }

    checkProximityAlerts() {
        if (!this.isActive) return;
        
        const userLocation = window.app?.controllers?.map?.userLocation;
        if (!userLocation) return;
        
        this.stations.forEach(station => {
            if (!station.coords || !station.currentDistance) return;
            
            const distanceMeters = station.currentDistance * 1000; // Converter km para metros
            
            if (distanceMeters <= CONFIG.DRIVER_ALERT_DISTANCE) {
                // Verificar cooldown
                const now = Date.now();
                const lastAlert = this.voiceAlertCooldown[station.id] || 0;
                
                if (now - lastAlert > CONFIG.DRIVER_ALERT_COOLDOWN) {
                    this.voiceAlertCooldown[station.id] = now;
                    
                    this.speakAlert(
                        `Atenção! Você está a ${Math.round(distanceMeters)} metros do posto ${station.name}. ` +
                        `Preço da gasolina: R$ ${station.prices?.gas || '--'}`
                    );
                    
                    // Destaque visual no painel
                    this.highlightStation(station.id);
                }
            }
        });
    }

    highlightStation(stationId) {
        const cards = document.querySelectorAll('.driver-station-card');
        cards.forEach((card, index) => {
            if (this.stations[index]?.id === stationId) {
                card.classList.add('highlighted');
                setTimeout(() => {
                    card.classList.remove('highlighted');
                }, 5000);
            }
        });
    }

    speakAlert(message) {
        if (!this.speechSynthesis || !this.isActive) return;
        
        // Cancelar fala anterior
        this.speechSynthesis.cancel();
        
        try {
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.lang = 'pt-BR';
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 0.8;
            
            // Tentar usar voz em português
            const voices = this.speechSynthesis.getVoices();
            const portugueseVoice = voices.find(voice => 
                voice.lang.includes('pt') || voice.lang.includes('PT')
            );
            
            if (portugueseVoice) {
                utterance.voice = portugueseVoice;
            }
            
            this.speechSynthesis.speak(utterance);
            console.log('🗣️ Alerta de voz:', message);
        } catch (error) {
            console.error('Erro na síntese de voz:', error);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    cleanup() {
        if (this.distanceInterval) {
            clearInterval(this.distanceInterval);
        }
        if (this.speechSynthesis) {
            this.speechSynthesis.cancel();
        }
    }
}

window.DriverController = DriverController;