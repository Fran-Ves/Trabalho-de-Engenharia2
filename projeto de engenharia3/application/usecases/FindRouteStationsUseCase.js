export class FindRouteStationsUseCase {
  constructor(stationRepository, distanceCalculator) {
    this.stationRepository = stationRepository;
    this.distanceCalculator = distanceCalculator;
  }

  async execute(routeCoords, maxDistance = 50) {
    const stations = await this.stationRepository.getAll();
    const routePoints = routeCoords.map(c => ({
      lat: c.lat !== undefined ? c.lat : c[0],
      lng: c.lng !== undefined ? c.lng : c[1]
    }));
    
    return stations.filter(station => {
      if (!station.coords) return false;
      
      const stationLoc = { lat: station.coords[0], lng: station.coords[1] };
      
      for (let i = 0; i < routePoints.length - 1; i++) {
        const p1 = routePoints[i];
        const p2 = routePoints[i + 1];
        const dist = this.distanceCalculator.pointToSegmentDistance(stationLoc, p1, p2);
        
        if (dist <= maxDistance) {
          return true;
        }
      }
      
      return false;
    });
  }
}