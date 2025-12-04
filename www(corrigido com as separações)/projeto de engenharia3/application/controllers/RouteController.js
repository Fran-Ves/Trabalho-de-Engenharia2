export class RouteController {
  constructor(routeService, findRouteStationsUseCase, uiService) {
    this.routeService = routeService;
    this.findRouteStationsUseCase = findRouteStationsUseCase;
    this.uiService = uiService;
    this.isSelectingWaypoints = false;
    this.waypoints = [];
  }

  startRouteMode() {
    this.isSelectingWaypoints = true;
    this.waypoints = [];
    this.uiService.showToast('📍 Selecione dois pontos no mapa para traçar a rota');
  }

  async handleMapClick(latlng) {
    if (!this.isSelectingWaypoints) return;
    
    this.waypoints.push(latlng);
    this.uiService.addTemporaryMarker(latlng);
    
    if (this.waypoints.length === 2) {
      this.isSelectingWaypoints = false;
      await this.calculateRoute();
    }
  }

  async calculateRoute() {
    try {
      this.routeService.setWaypoints(this.waypoints);
      
      // Aguardar cálculo da rota
      const route = await this._getRouteFromService();
      
      if (route && route.coordinates) {
        const stations = await this.findRouteStationsUseCase.execute(route.coordinates);
        this.uiService.showRouteStations(stations);
        
        if (stations.length > 0) {
          this.uiService.askToEnableDriverMode(stations.length);
        }
      }
    } catch (error) {
      console.error('Erro ao calcular rota:', error);
      this.uiService.showToast('Erro ao calcular rota', 'error');
    }
  }

  stopRoute() {
    this.routeService.clear();
    this.waypoints = [];
    this.uiService.hideRouteStations();
    this.uiService.showToast('Rota removida');
  }

  async _getRouteFromService() {
    // Implementar obtenção da rota do RouteService
    return new Promise(resolve => {
      this.routeService.control.on('routesfound', (e) => {
        resolve(e.routes[0]);
      });
    });
  }
}