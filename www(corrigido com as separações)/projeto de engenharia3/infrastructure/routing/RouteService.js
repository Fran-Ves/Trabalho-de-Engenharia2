export class RouteService {
  constructor(map) {
    this.map = map;
    this.control = null;
    this.waypoints = [];
  }

  init() {
    this.control = L.Routing.control({
      router: L.Routing.osrmv1({ 
        serviceUrl: 'https://router.project-osrm.org/route/v1' 
      }),
      waypoints: [],
      routeWhileDragging: true,
      fitSelectedRoutes: true,
      showAlternatives: false,
      show: false,
      addWaypoints: false,
      draggableWaypoints: false
    }).addTo(this.map);
    
    return this.control;
  }

  setWaypoints(waypoints) {
    this.waypoints = waypoints;
    if (this.control) {
      this.control.setWaypoints(waypoints);
    }
  }

  clear() {
    this.setWaypoints([]);
    this.waypoints = [];
  }
}