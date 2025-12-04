export class FindStationsUseCase {
  constructor(stationRepository, trustService, bestValueService) {
    this.stationRepository = stationRepository;
    this.trustService = trustService;
    this.bestValueService = bestValueService;
  }

  async execute(options = {}) {
    const stations = await this.stationRepository.getAll();
    
    // Calcular confiabilidade
    stations.forEach(station => {
      station.trustScore = this.trustService.calculate(station);
    });
    
    // Calcular melhor custo-benefício
    this.bestValueService.calculateBestValue(stations);
    
    // Aplicar filtros
    let filtered = stations;
    
    if (options.searchQuery) {
      filtered = this._filterBySearch(filtered, options.searchQuery);
    }
    
    if (options.sortBy) {
      filtered = this._sortStations(filtered, options.sortBy);
    }
    
    return filtered;
  }

  _filterBySearch(stations, query) {
    const searchTerm = query.toLowerCase().trim();
    return stations.filter(station => 
      station.name.toLowerCase().includes(searchTerm) ||
      (station.cnpj && station.cnpj.includes(searchTerm))
    );
  }

  _sortStations(stations, sortBy) {
    const sorted = [...stations];
    
    if (sortBy === 'price') {
      sorted.sort((a, b) => {
        const priceA = a.prices?.gas ? parseFloat(a.prices.gas) : Infinity;
        const priceB = b.prices?.gas ? parseFloat(b.prices.gas) : Infinity;
        return priceA - priceB;
      });
    } else if (sortBy === 'trust') {
      sorted.sort((a, b) => {
        const trustA = parseFloat(a.trustScore) || 0;
        const trustB = parseFloat(b.trustScore) || 0;
        return trustB - trustA;
      });
    }
    
    return sorted;
  }
}