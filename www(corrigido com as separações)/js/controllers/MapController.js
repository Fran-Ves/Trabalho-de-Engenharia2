class MapController {
    constructor(database) {
        this.database = database;
        this.map = null;
        this.markers = new Map(); // id -> marker
        this.userLocation = null;
        this.isTracking = false;
        this.watchId = null;
    }

    async init() {
        await this.initMap();
        await this.loadStations();
        this.setupMapEvents();
    }

    async initMap() {
        return new Promise((resolve) => {
        // Adicione um delay para garantir que o DOM esteja pronto
        setTimeout(() => {
            const mapContainer = document.getElementById('map');
            if (!mapContainer) {
                console.error('Container do mapa não encontrado, tentando novamente...');
                // Tente novamente após 500ms
                setTimeout(() => this.initMap().then(resolve), 500);
                return;
            }


            // Posição padrão (Picos, PI)
            const defaultCoords = [-7.076944, -41.466944];
            
            this.map = L.map('map').setView(defaultCoords, 13);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);

            // Tentar obter localização do usuário
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const userCoords = [position.coords.latitude, position.coords.longitude];
                        this.map.setView(userCoords, 15);
                        resolve(true);
                    },
                    () => {
                        this.map.setView(defaultCoords, 13);
                        resolve(true);
                    },
                    { timeout: 3000 }
                );
            } else {
                this.map.setView(defaultCoords, 13);
                resolve(true);
            }
        }, 100
        );

        });
    }

    async loadStations() {
    try {
        // Use window.Station se existir, senão use o database diretamente
        if (window.Station && typeof window.Station.findAll === 'function') {
            const stations = await window.Station.findAll();
            stations.forEach(station => this.addStationMarker(station));
        } else {
            // Fallback: carregue do database diretamente
            const stations = await this.database.getAll('stations');
            stations.forEach(stationData => {
                const station = new Station(stationData);
                this.addStationMarker(station);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar estações:', error);
    }
}

    addStationMarker(station) {
        if (!station.coords || !this.map) return;

        const color = station.isBestValue ? '#00c853' : '#1976d2';
        const radius = station.isBestValue ? 14 : 10;
        const className = station.isBestValue ? 'marker-best-value' : '';

        const marker = L.circleMarker(station.coords, {
            radius,
            color,
            fillColor: color,
            fillOpacity: 0.8,
            weight: 2,
            className
        }).addTo(this.map);

        marker.stationId = station.id;
        this.markers.set(station.id, marker);

        marker.bindPopup(this.createPopupContent(station));
        
        marker.on('click', () => {
            marker.openPopup();
        });

        return marker;
    }

    createPopupContent(station) {
        const pendingHtml = station.pendingChanges.length > 0 ? 
            this.createPendingChangesHtml(station) : '';

        return `
            <div class="station-popup">
                <h3>${station.name} ${station.isBestValue ? '⭐' : ''}</h3>
                <div class="station-info">
                    <span class="trust-score">Confiança: ${station.trustScore.toFixed(1)}/10</span>
                    ${station.isVerified ? '<span class="verified">✓ Verificado</span>' : ''}
                </div>
                <div class="prices">
                    <div>Gasolina: <strong>R$ ${station.prices.gas || '--'}</strong>
                        <button onclick="app.controllers.station.suggestPrice('${station.id}', 'gas')">↻</button>
                    </div>
                    <div>Etanol: <strong>R$ ${station.prices.etanol || '--'}</strong>
                        <button onclick="app.controllers.station.suggestPrice('${station.id}', 'etanol')">↻</button>
                    </div>
                    <div>Diesel: <strong>R$ ${station.prices.diesel || '--'}</strong>
                        <button onclick="app.controllers.station.suggestPrice('${station.id}', 'diesel')">↻</button>
                    </div>
                </div>
                ${pendingHtml}
                <div class="actions">
                    <button onclick="app.controllers.map.navigateToStation('${station.id}')">
                        Navegar para aqui
                    </button>
                </div>
            </div>
        `;
    }

    navigateToStation(stationId) {
        const marker = this.markers.get(stationId);
        if (marker) {
            this.map.setView(marker.getLatLng(), 16);
            marker.openPopup();
            
            // Adicionar efeito visual
            const originalColor = marker.options.color;
            marker.setStyle({ color: '#FF9800', fillColor: '#FFB74D' });
            
            setTimeout(() => {
                marker.setStyle({ color: originalColor, fillColor: originalColor });
            }, 2000);
        }
    }

    toggleLocationTracking() {
        if (this.isTracking) {
            this.stopTracking();
        } else {
            this.startTracking();
        }
    }

    startTracking() {
        if (!navigator.geolocation) {
            Toast.show('Geolocalização não suportada');
            return;
        }

        this.isTracking = true;
        const btn = document.getElementById('locationBtn');
        if (btn) btn.classList.add('active');

        // Primeira localização
        navigator.geolocation.getCurrentPosition(
            (position) => this.updateUserLocation(position),
            (error) => this.handleLocationError(error),
            { enableHighAccuracy: true, timeout: 5000 }
        );

        // Watch para atualizações
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.updateUserLocation(position),
            (error) => this.handleLocationError(error),
            { 
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 10000
            }
        );

        Toast.show('📍 Seguindo sua localização');
    }

    stopTracking() {
        this.isTracking = false;
        
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        
        const btn = document.getElementById('locationBtn');
        if (btn) btn.classList.remove('active');
        
        // Remover marcador
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
            this.userMarker = null;
        }
        
        Toast.show('📍 Parou de seguir localização');
    }

    updateUserLocation(position) {
        const coords = [position.coords.latitude, position.coords.longitude];
        
        // Remover marcador anterior
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
        }
        
        // Criar novo marcador
        this.userMarker = L.marker(coords, {
            icon: L.divIcon({
                className: 'user-location-marker',
                html: '<div class="user-pulse"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            }),
            zIndexOffset: 1000
        }).addTo(this.map);
        
        // Círculo de precisão
        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
        }
        
        this.accuracyCircle = L.circle(coords, {
            radius: position.coords.accuracy,
            color: '#1976d2',
            fillColor: '#1976d2',
            fillOpacity: 0.1,
            weight: 1
        }).addTo(this.map);
        
        // Centralizar se no modo motorista
        if (window.app?.controllers?.driver?.isActive) {
            this.map.setView(coords, Math.max(15, this.map.getZoom()));
        }
    }

    setupMapEvents() {
        if (!this.map) return;
        
        // Clique no mapa para selecionar localização
        this.map.on('click', (e) => {
            if (window.selectingLocationForPosto) {
                window.dispatchEvent(new CustomEvent('location:selected', {
                    detail: { latlng: e.latlng }
                }));
            }
        });
    }

    getMap() {
        return this.map;
    }
}
window.MapController = MapController;