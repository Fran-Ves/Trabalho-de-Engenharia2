export class Route {
  constructor(waypoints = []) {
    this.waypoints = waypoints;
    this.stations = [];
    this.length = 0;
    this.createdAt = new Date();
  }

  addWaypoint(latlng) {
    this.waypoints.push(latlng);
  }

  clear() {
    this.waypoints = [];
    this.stations = [];
  }
}