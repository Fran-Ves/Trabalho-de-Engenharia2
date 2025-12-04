import { IndexedDBRepository } from './infrastructure/persistence/IndexedDBRepository.js';
import { MapService } from './infrastructure/mapping/MapService.js';
import { RouteService } from './infrastructure/routing/RouteService.js';
import { TrustCalculationService } from './domain/services/TrustCalculationService.js';
import { BestValueService } from './domain/services/BestValueService.js';
import { FindStationsUseCase } from './application/usecases/FindStationsUseCase.js';
import { FindRouteStationsUseCase } from './application/usecases/FindRouteStationsUseCase.js';
import { StationController } from './presentation/controllers/StationController.js';
import { RouteController } from './presentation/controllers/RouteController.js';
import { UIService } from './presentation/ui/UIService.js';
import { DistanceCalculator } from './domain/services/DistanceCalculator.js';

class Application {
  constructor() {
    this.init();
  }

  async init() {
    try {
      // 1. Inicializar infraestrutura
      this.stationRepository = new IndexedDBRepository();
      await this.stationRepository.init();
      
      this.mapService = new MapService('map');
      this.routeService = new RouteService(this.mapService.map);
      this.routeService.init();
      
      // 2. Inicializar serviços de domínio
      this.trustService = TrustCalculationService;
      this.bestValueService = BestValueService;
      this.distanceCalculator = new DistanceCalculator();
      
      // 3. Inicializar casos de uso
      this.findStationsUseCase = new FindStationsUseCase(
        this.stationRepository,
        this.trustService,
        this.bestValueService
      );
      
      this.findRouteStationsUseCase = new FindRouteStationsUseCase(
        this.stationRepository,
        this.distanceCalculator
      );
      
      // 4. Inicializar UI
      this.uiService = new UIService();
      
      // 5. Inicializar controladores
      this.stationController = new StationController(
        this.findStationsUseCase,
        this.mapService,
        this.uiService
      );
      
      this.routeController = new RouteController(
        this.routeService,
        this.findRouteStationsUseCase,
        this.uiService
      );
      
      // 6. Configurar eventos
      this.setupEventListeners();
      
      // 7. Carregar dados iniciais
      await this.stationController.loadAndRenderStations();
      
      console.log('✅ Aplicação inicializada com sucesso');
    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      this.uiService.showToast('Erro ao iniciar aplicação', 'error');
    }
  }

  setupEventListeners() {
    // Eventos do mapa
    this.mapService.on('click', (e) => {
      this.routeController.handleMapClick(e.latlng);
    });
    
    // Eventos da UI
    document.addEventListener('search-stations', (e) => {
      this.stationController.searchStations(e.detail.query);
    });
    
    document.addEventListener('start-route-mode', () => {
      this.routeController.startRouteMode();
    });
    
    document.addEventListener('stop-route', () => {
      this.routeController.stopRoute();
    });
    
    // Configurar botões
    document.getElementById('homeBuscar')?.addEventListener('click', () => {
      document.getElementById('searchInput')?.focus();
    });
    
    document.getElementById('sbTracarRotas')?.addEventListener('click', () => {
      this.uiService.emitEvent('start-route-mode');
    });
  }
}

// Iniciar aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
  window.app = new Application();
});