// Configurações e constantes do aplicativo

const CONFIG = {
    // Mapa
    DEFAULT_COORDS: [-7.076944, -41.466944], // Picos, PI
    DEFAULT_ZOOM: 13,
    USER_ZOOM: 15,
    
    // Postos
    SEARCH_RADIUS_KM: 2, // Raio para buscar postos próximos
    ROUTE_BUFFER_METERS: 50, // Raio para considerar posto na rota
    DRIVER_ALERT_DISTANCE: 20, // Metros para alerta no modo motorista
    
    // Confiabilidade
    TRUST_SCORE_DEFAULT: 5.0,
    TRUST_SCORE_VERIFIED_BONUS: 3.0,
    TRUST_SCORE_PRICE_BONUS: 0.5,
    TRUST_SCORE_MULTIPLE_FUELS_BONUS: 0.5,
    
    // Preços
    MIN_VOTES_TO_CONFIRM: 3,
    PENDING_CHANGE_MAX_DAYS: 7, // Dias até uma pendência expirar
    
    // Modo Motorista
    DRIVER_ALERT_COOLDOWN: 120000, // 2 minutos em milissegundos
    
    // API
    OSRM_SERVICE_URL: 'https://router.project-osrm.org/route/v1',
    
    // IndexedDB
    DB_NAME: 'PostosAppDB',
    DB_VERSION: 3
};

const FUEL_TYPES = {
    GAS: 'gas',
    ETHANOL: 'etanol',
    DIESEL: 'diesel'
};

const FUEL_NAMES = {
    [FUEL_TYPES.GAS]: 'Gasolina',
    [FUEL_TYPES.ETHANOL]: 'Etanol',
    [FUEL_TYPES.DIESEL]: 'Diesel'
};

const USER_TYPES = {
    USER: 'user',
    POSTO: 'posto'
};

window.USER_TYPES ={
    USER: 'user',
    POSTO: 'posto'
};

window.CONFIG={
    DRIVER_ALERT_DISSTANCE: 500,
    DRIVER_ALERT_COOLDOWN: 30000
};