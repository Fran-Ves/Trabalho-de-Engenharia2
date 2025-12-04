export class StationController {
  constructor(findStationsUseCase, mapService, uiService) {
    this.findStationsUseCase = findStationsUseCase;
    this.mapService = mapService;
    this.uiService = uiService;
    this.currentStations = [];
  }

  async loadAndRenderStations() {
    try {
      this.currentStations = await this.findStationsUseCase.execute();
      this._renderStationsOnMap();
      this._updateUI();
    } catch (error) {
      console.error('Erro ao carregar postos:', error);
      this.uiService.showToast('Erro ao carregar postos', 'error');
    }
  }

  async searchStations(query) {
    try {
      this.currentStations = await this.findStationsUseCase.execute({
        searchQuery: query
      });
      this._renderStationsOnMap();
      this.uiService.showToast(`${this.currentStations.length} posto(s) encontrado(s)`);
    } catch (error) {
      console.error('Erro na busca:', error);
    }
  }

  _renderStationsOnMap() {
    this.mapService.clearMarkers();
    
    this.currentStations.forEach(station => {
      this.mapService.addStationMarker(station, (selectedStation) => {
        this._showStationDetails(selectedStation);
      });
    });
  }

  _showStationDetails(station) {
    this.uiService.showStationPopup(station);
  }

  _updateUI() {
    // Atualizar lista lateral, contadores, etc.
  }
}