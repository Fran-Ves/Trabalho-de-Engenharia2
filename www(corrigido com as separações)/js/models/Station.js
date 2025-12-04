class Station {
    constructor(data = {}) {
        this.id = data.id || `station_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = data.name || '';
        this.cnpj = data.cnpj || '';
        this.coords = data.coords || null;
        this.prices = data.prices || {
            gas: null,
            etanol: null,
            diesel: null
        };
        this.trustScore = data.trustScore || 5.0;
        this.isVerified = data.isVerified || false;
        this.isBestValue = data.isBestValue || false;
        this.pendingChanges = data.pendingChanges || [];
        this.type = 'posto';
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = Date.now();
    }

    static async create(data) {
        const station = new Station(data);
        await station.save();
        return station;
    }

    async save() {
        if (!window.app?.database) {
            throw new Error('Database não inicializado');
        }
        
        this.updatedAt = Date.now();
        await window.app.database.put('stations', this.toJSON());
        
        // Disparar evento de atualização
        window.dispatchEvent(new CustomEvent('station:updated', {
            detail: { stationId: this.id }
        }));
    }

    static async findById(id) {
        const data = await window.app.database.get('stations', id);
        return data ? new Station(data) : null;
    }

    static async findAll() {
        const data = await window.app.database.getAll('stations');
        return data.map(item => new Station(item));
    }

    static async findNearby(lat, lng, radiusKm = 2) {
        const stations = await this.findAll();
        return stations.filter(station => {
            if (!station.coords) return false;
            const distance = Station.calculateDistance(
                lat, lng,
                station.coords[0], station.coords[1]
            );
            return distance <= radiusKm;
        });
    }

    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Raio da Terra em km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    static toRad(degrees) {
        return degrees * (Math.PI/180);
    }

    addPendingChange(fuelType, price, userId) {
        this.pendingChanges.push({
            type: fuelType,
            price: parseFloat(price),
            votes: 1,
            users: [userId],
            timestamp: Date.now()
        });
    }

    confirmPendingChange(index, userId) {
        if (!this.pendingChanges[index]) return false;
        
        const change = this.pendingChanges[index];
        if (change.users.includes(userId)) return false;
        
        change.votes += 1;
        change.users.push(userId);
        
        if (change.votes >= 3) {
            this.prices[change.type] = change.price;
            this.pendingChanges.splice(index, 1);
            this.trustScore = Math.min(10, this.trustScore + 1);
            this.isVerified = true;
            return 'confirmed';
        }
        
        this.trustScore = Math.min(10, this.trustScore + 0.5);
        return 'voted';
    }

    updatePrice(fuelType, price) {
        this.prices[fuelType] = parseFloat(price);
        this.updatedAt = Date.now();
        
        // Registrar no histórico
        if (window.app?.database) {
            window.app.database.addPriceHistory(this.id, fuelType, price);
        }
    }

    calculateTrustScore() {
        let score = 5.0;
        
        if (this.isVerified) score += 3.0;
        if (this.pendingChanges.length === 0) score += 1.0;
        
        // Bônus por preços competitivos
        if (this.prices.gas && this.prices.gas < 6.00) score += 0.5;
        
        // Bônus por múltiplos combustíveis
        const filledPrices = Object.values(this.prices).filter(p => p !== null).length;
        if (filledPrices >= 2) score += 0.5;
        
        // Penalidade por preços pendentes antigos
        const oldPending = this.pendingChanges.filter(p => 
            Date.now() - p.timestamp > 7 * 24 * 60 * 60 * 1000 // 7 dias
        ).length;
        score -= oldPending * 0.5;
        
        this.trustScore = Math.max(1, Math.min(10, score));
        return this.trustScore;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            cnpj: this.cnpj,
            coords: this.coords,
            prices: this.prices,
            trustScore: this.trustScore,
            isVerified: this.isVerified,
            isBestValue: this.isBestValue,
            pendingChanges: this.pendingChanges,
            type: this.type,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

window.Station = Station;