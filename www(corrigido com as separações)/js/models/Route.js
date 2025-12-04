class Route {
    constructor(data = {}) {
        this.id = data.id || `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = data.name || 'Rota sem nome';
        this.waypoints = data.waypoints || []; // Array de [lat, lng]
        this.stations = data.stations || []; // IDs dos postos na rota
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = Date.now();
        
        // Metadados
        this.distance = data.distance || 0; // em metros
        this.duration = data.duration || 0; // em segundos
    }

    static async create(data) {
        const route = new Route(data);
        await route.save();
        return route;
    }

    async save() {
        if (!window.app?.database) {
            throw new Error('Database não inicializado');
        }
        
        this.updatedAt = Date.now();
        await window.app.database.put('routes', this.toJSON());
        
        window.dispatchEvent(new CustomEvent('route:updated', {
            detail: { routeId: this.id }
        }));
    }

    static async findById(id) {
        const data = await window.app.database.get('routes', id);
        return data ? new Route(data) : null;
    }

    static async findAll() {
        const data = await window.app.database.getAll('routes');
        return data.map(item => new Route(item));
    }

    async addStation(stationId) {
        if (!this.stations.includes(stationId)) {
            this.stations.push(stationId);
            await this.save();
        }
    }

    async removeStation(stationId) {
        const index = this.stations.indexOf(stationId);
        if (index > -1) {
            this.stations.splice(index, 1);
            await this.save();
        }
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            waypoints: this.waypoints,
            stations: this.stations,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            distance: this.distance,
            duration: this.duration
        };
    }
}

window.Route = Route;