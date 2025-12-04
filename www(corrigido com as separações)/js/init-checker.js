// js/init-checker.js
console.log('🔍 Verificando inicialização da aplicação...');

// Verificar periodicamente se tudo está carregado
setInterval(() => {
    const status = {
        App: typeof App !== 'undefined',
        appInstance: typeof window.app !== 'undefined',
        map: window.app?.controllers?.map?.map ? 'SIM' : 'NÃO',
        routeController: window.app?.controllers?.route ? 'SIM' : 'NÃO'
    };
    
    console.log('📊 Status da aplicação:', status);
    
    // Se o mapa estiver disponível mas o RouteController não tiver, conectar
    if (status.map === 'SIM' && window.app?.controllers?.route && !window.app.controllers.route.map) {
        console.log('🔗 Conectando mapa ao RouteController...');
        window.app.controllers.route.map = window.app.controllers.map.map;
    }
}, 3000);

// Função global para forçar início do modo rota
window.forceStartRouteMode = function() {
    console.log('🚀 Forçando início do modo rota...');
    
    if (!window.app || !window.app.controllers) {
        console.error('❌ Aplicação não inicializada');
        return;
    }
    
    if (!window.app.controllers.route) {
        console.error('❌ RouteController não disponível');
        return;
    }
    
    window.app.controllers.route.startRouteMode();
};