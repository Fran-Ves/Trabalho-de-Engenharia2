// js/route-integration.js
console.log('🛣️ Carregando integração de rotas...');

// Funções globais para compatibilidade com código antigo
window.startRouteMode = function() {
    if (window.app && window.app.controllers && window.app.controllers.route) {
        window.app.controllers.route.startRouteMode();
    } else {
        console.error('❌ RouteController não disponível');
        Toast.show('Erro: Sistema de rotas não disponível');
    }
};

window.stopCurrentRoute = function() {
    if (window.app && window.app.controllers && window.app.controllers.route) {
        window.app.controllers.route.stopCurrentRoute();
    }
};

window.renderRouteStationsPanel = function(stations) {
    if (window.app && window.app.controllers && window.app.controllers.route) {
        window.app.controllers.route.renderRouteStationsPanel(stations);
    }
};

// Funções de cálculo de distância (mantidas para compatibilidade)
window.getDistanceFromPointToSegment = function(P, A, B) {
    function toRad(x) { return x * Math.PI / 180; }
    function haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const φ1 = toRad(lat1);
        const φ2 = toRad(lat2);
        const Δφ = toRad(lat2 - lat1);
        const Δλ = toRad(lon2 - lon1);
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    const AP = [P.lat - A.lat, P.lng - A.lng];
    const AB = [B.lat - A.lat, B.lng - A.lng];
    
    const dot = AP[0] * AB[0] + AP[1] * AB[1];
    const lenSq = AB[0] * AB[0] + AB[1] * AB[1];
    
    const t = Math.max(0, Math.min(1, dot / lenSq));
    
    const closestLat = A.lat + t * AB[0];
    const closestLng = A.lng + t * AB[1];
    
    return haversineDistance(P.lat, P.lng, closestLat, closestLng);
};

// Adicionar ao loader.js (adicione ao array de scripts):
// 'js/route-integration.js'