// Utilitários para cálculos geográficos

class GeoUtils {
    // Calcular distância entre dois pontos em km
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

    // Converter graus para radianos
    static toRad(degrees) {
        return degrees * (Math.PI/180);
    }

    // Calcular distância de ponto a segmento de linha em metros
    static distanceToSegment(P, A, B) {
        // P, A, B são objetos com lat, lng
        
        // Primeiro, converter para coordenadas cartesianas (aproximação para pequenas distâncias)
        const x = P.lng - A.lng;
        const y = P.lat - A.lat;
        const dx = B.lng - A.lng;
        const dy = B.lat - A.lat;
        
        const dot = x * dx + y * dy;
        const lenSq = dx * dx + dy * dy;
        let param = -1;
        
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        
        let xx, yy;
        
        if (param < 0) {
            xx = A.lng;
            yy = A.lat;
        } else if (param > 1) {
            xx = B.lng;
            yy = B.lat;
        } else {
            xx = A.lng + param * dx;
            yy = A.lat + param * dy;
        }
        
        // Calcular distância em metros
        return this.calculateDistance(P.lat, P.lng, yy, xx) * 1000;
    }

    // Verificar se um ponto está dentro de um raio de outro ponto
    static isWithinRadius(lat1, lon1, lat2, lon2, radiusMeters) {
        const distance = this.calculateDistance(lat1, lon1, lat2, lon2) * 1000;
        return distance <= radiusMeters;
    }

    // Calcular bounding box a partir de um ponto central e raio
    static getBoundingBox(lat, lon, radiusKm) {
        const latDelta = radiusKm / 111.32; // Aproximadamente 111.32 km por grau de latitude
        const lonDelta = radiusKm / (111.32 * Math.cos(this.toRad(lat)));
        
        return {
            minLat: lat - latDelta,
            maxLat: lat + latDelta,
            minLon: lon - lonDelta,
            maxLon: lon + lonDelta
        };
    }

    // Formatar distância para exibição
    static formatDistance(distanceKm) {
        if (distanceKm < 1) {
            return `${Math.round(distanceKm * 1000)} m`;
        }
        return `${distanceKm.toFixed(1)} km`;
    }

    // Calcular rota simplificada entre dois pontos (usando OSRM)
    static async calculateRoute(start, end) {
        try {
            const response = await fetch(
                `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full`
            );
            const data = await response.json();
            
            if (data.routes && data.routes.length > 0) {
                return {
                    distance: data.routes[0].distance, // em metros
                    duration: data.routes[0].duration, // em segundos
                    coordinates: data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]])
                };
            }
        } catch (error) {
            console.error('Erro ao calcular rota:', error);
        }
        
        return null;
    }
}

window.GeoUtils = GeoUtils;