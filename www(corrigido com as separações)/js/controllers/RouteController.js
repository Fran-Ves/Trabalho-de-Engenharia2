// RouteController.js - VERSÃO COMPLETA
class RouteController {
    constructor(database) {
        this.database = database;
        this.routingControl = null;
        this.selectingWaypoints = false;
        this.tempWaypoints = [];
        this.tempMarkers = [];
        this.routeFoundStations = [];
        this.currentSortMode = 'price';
        this.map = null;
        this.routeLine = null;
    }

    async init(map = null) {
        console.log('🛣️ RouteController inicializando...');
        
        if (map) {
            this.map = map;
            console.log('🗺️ Mapa recebido pelo RouteController');
            
            // Inicializar o controle de rota APENAS se o mapa estiver pronto
            setTimeout(() => {
                this.initRoutingControl();
            }, 1000); // Aguardar 1 segundo para garantir que tudo está carregado
        } else {
            console.warn('⚠️ RouteController inicializado sem mapa');
            // Tentar obter o mapa mais tarde
            setTimeout(() => {
                this.tryGetMap();
            }, 2000);
        }
        
        return Promise.resolve();
    }

    async tryGetMap() {
        if (window.app?.controllers?.map?.getMap) {
            const map = window.app.controllers.map.getMap();
            if (map) {
                console.log('🗺️ Mapa obtido posteriormente pelo RouteController');
                this.map = map;
                this.initRoutingControl();
            }
        }
    }

    async initRoutingControl() {
        console.log('🗺️ Inicializando controle de rota no mapa...');
        
        if (!this.map) {
            console.error('❌ Mapa não disponível para inicializar rota');
            return null;
        }
        
        if (!window.L || !window.L.Routing) {
            console.error('❌ Leaflet Routing Machine não carregado');
            // Tentar carregar dinamicamente
            this.loadRoutingMachine();
            return null;
        }
        
        try {
            this.routingControl = L.Routing.control({
                waypoints: [],
                routeWhileDragging: false,
                showAlternatives: false,
                fitSelectedRoutes: true,
                show: false,
                createMarker: (i, waypoint) => {
                    return L.marker(waypoint.latLng, {
                        icon: L.divIcon({
                            className: 'route-waypoint-marker',
                            html: `<div style="background:${i === 0 ? '#4CAF50' : '#FF9800'};color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);">${i + 1}</div>`,
                            iconSize: [24, 24],
                            iconAnchor: [12, 12]
                        })
                    });
                },
                lineOptions: {
                    styles: [{ 
                        color: '#1976d2', 
                        weight: 5, 
                        opacity: 0.7
                    }]
                },
                addWaypoints: false,
                draggableWaypoints: false
            }).addTo(this.map);

            // Evento quando a rota é encontrada
            this.routingControl.on('routesfound', (e) => {
                this.handleRoutesFound(e);
            });

            console.log('✅ Controle de rota inicializado com sucesso');
            return this.routingControl;
        } catch (error) {
            console.error('❌ Erro ao inicializar controle de rota:', error);
            return null;
        }
    }

    startRouteMode() {
        console.log('🛣️ Iniciando modo rota...');
    
        // Verificação EXTRA robusta
        if (!this.map) {
            // Tentar obter o mapa de várias fontes
            if (window.app?.controllers?.map?.map) {
                this.map = window.app.controllers.map.map;
            } else if (window.app?.controllers?.map?.getMap) {
                this.map = window.app.controllers.map.getMap();
            } else {
                console.error('❌ Mapa não disponível de forma alguma');
                Toast.show('⚠️ Mapa não está disponível. Aguarde ou recarregue a página.');
                return;
            }
        }
        
        if (!this.map) {
            console.error('❌ Mapa ainda não disponível após tentativas');
            Toast.show('⚠️ Aguarde o carregamento do mapa...');
            return;
        }
        
        console.log('✅ Mapa disponível para modo rota');
        
        // Resto do código permanece o mesmo...
        // Verificar se estamos no modo motorista
        if (window.app?.controllers?.driver?.isActive) {
            window.app.controllers.driver.exitDriverMode();
        }
        
        // Fechar sidebar se estiver aberta
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.add('hidden');
            this.adjustHomeButtonsForSidebar(false);
        }
        
        this.selectingWaypoints = true;
        this.tempWaypoints = [];
        
        // Limpar marcadores anteriores
        this.clearTemporaryMarkers();
        
        // Limpar rota anterior se existir
        if (this.routingControl) {
            this.routingControl.setWaypoints([]);
        }
        
        // Remover linha de rota anterior
        if (this.routeLine && this.map.hasLayer(this.routeLine)) {
            this.map.removeLayer(this.routeLine);
            this.routeLine = null;
        }
        
        // Adicionar evento de clique no mapa
        const clickHandler = this.handleRoutePointSelection.bind(this);
        this.map.on('click', clickHandler);
        this.currentClickHandler = clickHandler;
        
        // Mudar cursor do mapa
        this.map.getContainer().style.cursor = 'crosshair';
        
        Toast.show('📍 Selecione DOIS pontos no mapa para traçar a rota');
        
        // Mostrar botão para cancelar seleção
        this.showCancelButton();
        
        // Mostrar instruções
        this.showInstructions();
    }

    handleRoutePointSelection(e) {
        if (!this.selectingWaypoints) return;
        
        // Adicionar marcador temporário
        const marker = L.marker(e.latlng, {
            icon: L.divIcon({
                className: 'temp-marker',
                html: `<div style="background:${this.tempWaypoints.length === 0 ? '#4CAF50' : '#FF9800'};color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3);font-size:16px;">${this.tempWaypoints.length + 1}</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            })
        }).addTo(this.map);
        
        this.tempMarkers.push(marker);
        this.tempWaypoints.push(e.latlng);
        
        console.log(`📍 Ponto ${this.tempWaypoints.length} selecionado:`, e.latlng);
        Toast.show(`📍 Ponto ${this.tempWaypoints.length} selecionado`);
        
        // Se já tiver dois pontos, traçar a rota
        if (this.tempWaypoints.length === 2) {
            this.selectingWaypoints = false;
            this.map.off('click', this.currentClickHandler);
            this.map.getContainer().style.cursor = '';
            
            // Remover botão de cancelar
            this.removeCancelButton();
            
            // Remover instruções
            this.removeInstructions();
            
            // Traçar rota
            this.traceRoute();
        }
    }

    traceRoute() {
        if (!this.routingControl) {
            console.error('❌ Controle de rota não inicializado');
            Toast.show('❌ Erro ao traçar rota');
            return;
        }
        
        try {
            this.routingControl.setWaypoints(this.tempWaypoints);
            Toast.show('🗺️ Traçando rota... Aguarde');
        } catch (error) {
            console.error('❌ Erro ao traçar rota:', error);
            Toast.show('❌ Erro ao traçar rota');
            this.clearTemporaryMarkers();
        }
    }

    handleRoutesFound(e) {
        console.log('🛣️ Rota encontrada pelo Leaflet Routing Machine');
        
        const routes = e.routes;
        if (!routes || routes.length === 0) {
            Toast.show('❌ Não foi possível calcular a rota');
            return;
        }
        
        const route = routes[0];
        if (route && route.coordinates) {
            // 1. Salvar as coordenadas da rota
            this.routeCoordinates = route.coordinates;
            
            // 2. Encontrar postos próximos à rota
            this.findStationsAlongRoute();
            
            // 3. Destacar a rota no mapa
            this.highlightRouteOnMap();
            
            // 4. Atualizar a interface
            this.updateRouteUI();
        }
    }

    findStationsAlongRoute() {
        console.log('📐 Procurando postos próximos à rota...');
        
        if (!this.routeCoordinates || this.routeCoordinates.length < 2) {
            console.error('❌ Coordenadas da rota inválidas');
            return;
        }
        
        // Obter todas as estações
        const stations = window.app?.controllers?.station?.stations || [];
        console.log(`🔍 Analisando ${stations.length} estações`);
        
        this.routeFoundStations = stations.filter(station => {
            if (!station.coords) return false;
            
            const stationPoint = { 
                lat: station.coords[0], 
                lng: station.coords[1] 
            };
            
            // Verificar proximidade com cada segmento da rota
            for (let i = 0; i < this.routeCoordinates.length - 1; i++) {
                const pointA = this.routeCoordinates[i];
                const pointB = this.routeCoordinates[i + 1];
                
                // Converter para formato {lat, lng}
                const A = { lat: pointA.lat, lng: pointA.lng };
                const B = { lat: pointB.lat, lng: pointB.lng };
                
                const distance = window.getDistanceFromPointToSegment(stationPoint, A, B);
                
                if (distance <= 50) { // 50 metros
                    console.log(`📍 ${station.name} está a ${distance.toFixed(1)}m da rota`);
                    return true;
                }
            }
            
            return false;
        });
        
        console.log(`✅ Encontrados ${this.routeFoundStations.length} postos na rota`);
    }

    highlightRouteOnMap() {
        // Desenhar linha da rota
        if (this.routeLine && this.map.hasLayer(this.routeLine)) {
            this.map.removeLayer(this.routeLine);
        }
        
        this.routeLine = L.polyline(this.routeCoordinates, {
            color: '#1976d2',
            weight: 6,
            opacity: 0.8,
            dashArray: '15, 10',
            lineCap: 'round'
        }).addTo(this.map);
        
        // Destacar postos na rota
        this.highlightStationsOnRoute();
    }

    highlightStationsOnRoute() {
        // Primeiro, remover todos os marcadores existentes
        const mapController = window.app?.controllers?.map;
        if (!mapController) return;
        
        // Restaurar estilo padrão para todos os marcadores
        if (mapController.markers) {
            mapController.markers.forEach(marker => {
                marker.setStyle({
                    color: '#1976d2',
                    fillColor: '#1976d2',
                    radius: 10,
                    weight: 2
                });
            });
        }
        
        // Destacar postos na rota
        this.routeFoundStations.forEach(station => {
            const marker = mapController.markers?.get(station.id);
            if (marker) {
                marker.setStyle({
                    color: '#FF9800',
                    fillColor: '#FF9800',
                    radius: 14,
                    weight: 4
                });
                
                // Adicionar classe CSS para animação
                marker.getElement()?.classList?.add('marker-on-route');
                
                // Atualizar popup
                const popupContent = marker.getPopup()?.getContent() || '';
                if (!popupContent.includes('NA SUA ROTA')) {
                    marker.bindPopup(popupContent + 
                        '<div style="margin-top:8px;padding:4px;background:#FFF3E0;border-radius:4px;border-left:3px solid #FF9800;">' +
                        '<strong style="color:#FF9800;">📍 NA SUA ROTA</strong><br>' +
                        `<small>Distância: ${this.getStationDistanceFromRoute(station).toFixed(0)}m</small>` +
                        '</div>'
                    );
                }
            }
        });
    }

    getStationDistanceFromRoute(station) {
        if (!station.coords || !this.routeCoordinates) return Infinity;
        
        let minDistance = Infinity;
        const stationPoint = { lat: station.coords[0], lng: station.coords[1] };
        
        for (let i = 0; i < this.routeCoordinates.length - 1; i++) {
            const A = this.routeCoordinates[i];
            const B = this.routeCoordinates[i + 1];
            const pointA = { lat: A.lat, lng: A.lng };
            const pointB = { lat: B.lat, lng: B.lng };
            
            const distance = window.getDistanceFromPointToSegment(stationPoint, pointA, pointB);
            if (distance < minDistance) {
                minDistance = distance;
            }
        }
        
        return minDistance;
    }

    updateRouteUI() {
        // Atualizar sidebar com postos encontrados
        this.renderRouteStationsPanel();
        
        // Mostrar notificação
        if (this.routeFoundStations.length > 0) {
            Toast.show(`📍 Encontramos ${this.routeFoundStations.length} postos na sua rota!`);
            
            // Perguntar sobre modo motorista
            setTimeout(() => {
                if (confirm(`Deseja ativar o Modo Motorista para receber alertas destes ${this.routeFoundStations.length} postos?`)) {
                    window.app?.controllers?.driver?.enterDriverMode(this.routeFoundStations.slice(0, 3));
                }
            }, 1500);
        } else {
            Toast.show('⚠️ Nenhum posto encontrado próximo à rota');
        }
    }

    renderRouteStationsPanel() {
        const sidebar = document.getElementById('sidebar');
        const list = document.getElementById('routeSidebarList');
        const info = document.getElementById('routeInfoCompact');
        
        if (!sidebar || !list || !info) {
            console.error('❌ Elementos da sidebar não encontrados');
            return;
        }
        
        // Ordenar estações
        let sortedStations = [...this.routeFoundStations];
        if (this.currentSortMode === 'price') {
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
        
        // Limpar lista
        list.innerHTML = '';
        
        if (sortedStations.length === 0) {
            info.textContent = 'Nenhum posto na rota';
            list.innerHTML = '<li style="padding: 12px; text-align: center; color: #666;"><span class="name">Nenhum posto encontrado</span></li>';
        } else {
            info.textContent = `${sortedStations.length} postos na rota (${this.currentSortMode === 'price' ? 'por preço' : 'por confiança'})`;
            
            sortedStations.forEach((station, index) => {
                const li = document.createElement('li');
                li.className = 'route-station-item';
                if (station.isBestValue) {
                    li.classList.add('station-best');
                }
                if (index === 0 && this.currentSortMode === 'price') {
                    li.classList.add('station-cheapest');
                }
                
                const distance = this.getStationDistanceFromRoute(station);
                
                li.innerHTML = `
                    <div class="station-info">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <b>${this.escapeHtml(station.name)}</b>
                            ${station.isBestValue ? '<span style="color:#FFD700;">⭐</span>' : ''}
                        </div>
                        <div style="font-size: 11px; color: #666; margin-top: 2px;">
                            <span>Confiança: ${station.trustScore || '5.0'}/10</span>
                            <span style="margin-left: 8px;">Distância: ${distance.toFixed(0)}m</span>
                        </div>
                    </div>
                    <div class="price-tag" style="background:${index === 0 && this.currentSortMode === 'price' ? '#E8F5E9' : '#F5F5F5'}; color:${index === 0 && this.currentSortMode === 'price' ? '#2E7D32' : '#333'};">
                        R$ ${station.prices?.gas || '--'}
                    </div>
                `;
                
                // Clique para focar no posto
                li.addEventListener('click', () => {
                    if (window.app?.controllers?.map) {
                        window.app.controllers.map.navigateToStation(station.id);
                    }
                });
                
                list.appendChild(li);
            });
        }
        
        // Mostrar sidebar
        sidebar.classList.remove('hidden');
        this.adjustHomeButtonsForSidebar(true);
        
        // Atualizar controles de ordenação
        this.updateSortControls();
    }

    updateSortControls() {
        const sortByPrice = document.getElementById('sortByPrice');
        const sortByTrust = document.getElementById('sortByTrust');
        
        if (sortByPrice && sortByTrust) {
            if (this.currentSortMode === 'price') {
                sortByPrice.classList.add('active');
                sortByTrust.classList.remove('active');
            } else {
                sortByPrice.classList.remove('active');
                sortByTrust.classList.add('active');
            }
        }
    }

    setSortMode(mode) {
        this.currentSortMode = mode;
        if (this.routeFoundStations.length > 0) {
            this.renderRouteStationsPanel();
        }
    }

    stopCurrentRoute() {
        console.log('🛑 Parando rota atual...');
        
        // Limpar rota
        if (this.routingControl) {
            this.routingControl.setWaypoints([]);
        }
        
        // Remover linha da rota
        if (this.routeLine && this.map && this.map.hasLayer(this.routeLine)) {
            this.map.removeLayer(this.routeLine);
            this.routeLine = null;
        }
        
        // Limpar arrays
        this.routeFoundStations = [];
        this.tempWaypoints = [];
        this.routeCoordinates = null;
        
        // Remover marcadores temporários
        this.clearTemporaryMarkers();
        
        // Remover evento de clique
        if (this.currentClickHandler) {
            this.map.off('click', this.currentClickHandler);
            this.currentClickHandler = null;
        }
        
        // Restaurar cursor
        if (this.map) {
            this.map.getContainer().style.cursor = '';
        }
        
        // Fechar sidebar
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.add('hidden');
            this.adjustHomeButtonsForSidebar(false);
        }
        
        // Remover botão de cancelar
        this.removeCancelButton();
        
        // Remover instruções
        this.removeInstructions();
        
        // Restaurar marcadores no mapa
        if (window.app?.controllers?.map?.loadStations) {
            window.app.controllers.map.loadStations();
        }
        
        Toast.show('🗺️ Rota removida - Você pode traçar uma nova');
    }

    clearTemporaryMarkers() {
        this.tempMarkers.forEach(marker => {
            if (marker && this.map && this.map.hasLayer(marker)) {
                this.map.removeLayer(marker);
            }
        });
        this.tempMarkers = [];
    }

    adjustHomeButtonsForSidebar(sidebarOpen) {
        const homeQuick = document.getElementById('homeQuick');
        if (homeQuick) {
            if (sidebarOpen) {
                homeQuick.classList.add('sidebar-open');
                homeQuick.style.right = '340px';
            } else {
                homeQuick.classList.remove('sidebar-open');
                homeQuick.style.right = '20px';
            }
        }
    }

    showCancelButton() {
        // Remover botão anterior se existir
        this.removeCancelButton();
        
        // Criar botão de cancelar
        this.cancelButton = document.createElement('button');
        this.cancelButton.id = 'cancelRouteBtn';
        this.cancelButton.className = 'cancel-route-btn';
        this.cancelButton.innerHTML = '<i class="fa-solid fa-times"></i> Cancelar traçado';
        this.cancelButton.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 20px;
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
            color: white;
            border: none;
            padding: 14px 20px;
            border-radius: 10px;
            font-weight: bold;
            font-size: 14px;
            z-index: 2000;
            box-shadow: 0 6px 20px rgba(220, 53, 69, 0.4);
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: all 0.3s ease;
        `;
        
        this.cancelButton.addEventListener('click', () => {
            this.stopCurrentRoute();
        });
        
        this.cancelButton.addEventListener('mouseenter', () => {
            this.cancelButton.style.transform = 'translateY(-2px)';
            this.cancelButton.style.boxShadow = '0 8px 25px rgba(220, 53, 69, 0.5)';
        });
        
        this.cancelButton.addEventListener('mouseleave', () => {
            this.cancelButton.style.transform = 'translateY(0)';
            this.cancelButton.style.boxShadow = '0 6px 20px rgba(220, 53, 69, 0.4)';
        });
        
        document.body.appendChild(this.cancelButton);
    }

    removeCancelButton() {
        if (this.cancelButton && this.cancelButton.parentNode) {
            this.cancelButton.parentNode.removeChild(this.cancelButton);
            this.cancelButton = null;
        }
    }

    showInstructions() {
        this.instructionsPanel = document.createElement('div');
        this.instructionsPanel.id = 'routeInstructions';
        this.instructionsPanel.innerHTML = `
            <div style="position: fixed; top: 70px; left: 50%; transform: translateX(-50%); background: rgba(25, 118, 210, 0.95); color: white; padding: 12px 20px; border-radius: 8px; z-index: 2000; box-shadow: 0 4px 15px rgba(0,0,0,0.2); font-weight: bold; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2);">
                <i class="fa-solid fa-mouse-pointer" style="margin-right: 8px;"></i>
                Clique em DOIS pontos no mapa para traçar sua rota
            </div>
        `;
        document.body.appendChild(this.instructionsPanel);
    }

    removeInstructions() {
        if (this.instructionsPanel && this.instructionsPanel.parentNode) {
            this.instructionsPanel.parentNode.removeChild(this.instructionsPanel);
            this.instructionsPanel = null;
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    loadRoutingMachine() {
        console.log('📦 Tentando carregar Leaflet Routing Machine...');
        
        // Verificar se já está carregando
        if (window.loadingRoutingMachine) return;
        window.loadingRoutingMachine = true;
        
        // Carregar CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css';
        document.head.appendChild(link);
        
        // Carregar JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js';
        script.onload = () => {
            console.log('✅ Leaflet Routing Machine carregado com sucesso');
            window.loadingRoutingMachine = false;
            
            // Tentar inicializar novamente após 1 segundo
            setTimeout(() => {
                if (this.map && window.L && window.L.Routing) {
                    this.initRoutingControl();
                }
            }, 1000);
        };
        script.onerror = () => {
            console.error('❌ Falha ao carregar Leaflet Routing Machine');
            window.loadingRoutingMachine = false;
            Toast.show('⚠️ Sistema de navegação não disponível');
        };
        document.head.appendChild(script);
    }
}