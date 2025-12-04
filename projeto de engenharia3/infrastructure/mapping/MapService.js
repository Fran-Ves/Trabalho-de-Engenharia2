export class MapService {
  constructor(containerId, options = {}) {
    this.map = L.map(containerId).setView(options.center || [-7.076944, -41.466944], options.zoom || 13);
    this.markers = L.layerGroup().addTo(this.map);
    this.userMarker = null;
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);
  }

  addStationMarker(station, onClick) {
    const marker = L.circleMarker(station.coords, {
      radius: station.isBestValue ? 14 : 10,
      color: station.isBestValue ? '#00c853' : '#1976d2',
      fillColor: station.isBestValue ? '#00c853' : '#1976d2',
      fillOpacity: 0.8,
      weight: 2
    }).addTo(this.markers);
    
    marker.stationId = station.id;
    
    if (onClick) {
      marker.on('click', () => onClick(station));
    }
    
    return marker;
  }

  clearMarkers() {
    this.markers.clearLayers();
  }

  setView(coords, zoom) {
    this.map.setView(coords, zoom);
  }

  on(event, handler) {
    this.map.on(event, handler);
  }
}