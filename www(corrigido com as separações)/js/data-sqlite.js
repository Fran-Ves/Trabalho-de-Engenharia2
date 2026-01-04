/* data-sqlite.js — variáveis globais usando apenas SQLite */
console.log('📊 Inicializando sistema de dados SQLite...');

// Variáveis globais
let gasData = [];
let users = [];
let currentUser = null;
let stationComments = {};
let priceHistory = {};
let pendingPrices = {};
let certifications = {};

// Estado da aplicação
let locationSelectionContext = null;
let fromCadastro = false;
let previousScreenId = null;
let currentScreenId = null;
let selectingLocationForPosto = false;
let tempMarker = null;
let selectingWaypoints = false;
let tempWaypoints = [];
let tempWayMarkers = [];
let routeFoundStations = [];
let currentSortMode = 'price';
let driverMode = false;
let driverStations = [];
let voiceAlertCooldown = {};
let speechSynthesis = window.speechSynthesis;
let navigationStack = [];
let navigationHistory = [];
let isNavigatingBack = false;

// ========== FUNÇÕES DE DADOS COM SQLITE ==========
async function loadData() {
    console.log('📂 Carregando dados do SQLite...');
    
    try {
        // Verificar se SQLite está inicializado
        if (!window.sqlDB || !sqlDB.initialized) {
            console.warn('⚠️ SQLite não inicializado, tentando inicializar...');
            await initSQLDatabase();
        }
        
        if (window.sqlDB && sqlDB.initialized) {
            await loadDataFromSQL();
        } else {
            console.warn('⚠️ SQLite indisponível, usando localStorage');
            loadDataFromLocalStorage();
        }
        
        console.log('📊 Dados carregados:', {
            stations: gasData.length,
            users: users.length,
            currentUser: !!currentUser,
            comments: Object.keys(stationComments).length
        });
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        loadDataFromLocalStorage();
        return false;
    }
}

async function loadDataFromSQL() {
    console.log('📥 Carregando do SQLite...');
    
    try {
        if (!window.sqlDB) {
            throw new Error('SQL Database não inicializado');
        }
        
        // Carregar estações
        gasData = await sqlDB.getAllStations();
        
        // Carregar usuários
        users = await sqlDB.getAllUsers();
        
        // Carregar comentários
        const allComments = await sqlDB.query('SELECT * FROM comments ORDER BY date DESC');
        stationComments = {};
        allComments.forEach(comment => {
            if (!stationComments[comment.station_id]) {
                stationComments[comment.station_id] = [];
            }
            stationComments[comment.station_id].push(comment);
        });
        
        // Carregar histórico de preços
        const historyResults = await sqlDB.query('SELECT * FROM price_history ORDER BY date DESC');
        priceHistory = {};
        historyResults.forEach(record => {
            if (!priceHistory[record.station_id]) {
                priceHistory[record.station_id] = [];
            }
            priceHistory[record.station_id].push(record);
        });
        
        // Carregar preços pendentes
        const pendingResults = await sqlDB.query('SELECT * FROM pending_prices');
        pendingPrices = {};
        pendingResults.forEach(pending => {
            pendingPrices[pending.id] = {
                ...pending,
                users: JSON.parse(pending.users || '[]')
            };
        });
        
        // Carregar usuário atual da sessão
        try {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser && savedUser !== 'null') {
                currentUser = JSON.parse(savedUser);
                
                // Verificar se o usuário ainda existe no banco
                const userExists = users.some(u => u.id === currentUser.id);
                if (!userExists) {
                    console.warn('⚠️ Usuário da sessão não existe mais, limpando...');
                    currentUser = null;
                    localStorage.removeItem('currentUser');
                }
            }
        } catch(e) {
            console.warn('⚠️ Erro ao carregar usuário da sessão:', e);
            currentUser = null;
        }
        
        console.log(`✅ Dados carregados: ${gasData.length} estações, ${users.length} usuários`);
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao carregar do SQLite:', error);
        throw error;
    }
}

async function saveData() {
    console.log('💾 Salvando dados no SQLite...');
    
    try {
        // Salvar usuário atual na sessão
        if (currentUser) {
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        }
        
        // Se SQLite estiver disponível, salvar nele
        if (window.sqlDB && sqlDB.initialized) {
            await saveDataToSQL();
        } else {
            // Fallback para localStorage
            saveDataToLocalStorage();
        }
        
        console.log('✅ Dados salvos');
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao salvar dados:', error);
        
        // Fallback extremo
        saveDataToLocalStorage();
        return false;
    }
}

async function saveDataToSQL() {
    console.log('💾 Salvando no SQLite...');
    
    try {
        // Salvar estações
        for (const station of gasData) {
            const existing = await sqlDB.getStation(station.id);
            if (existing) {
                await sqlDB.updateStation(station);
            } else {
                await sqlDB.addStation(station);
            }
        }
        
        // Salvar usuários
        for (const user of users) {
            const existing = await sqlDB.getUser(user.id);
            if (existing) {
                await sqlDB.updateUser(user);
            } else {
                await sqlDB.addUser(user);
            }
        }
        
        // Nota: Comentários são salvos separadamente via addCommentToStation
        // Nota: Histórico de preços é salvo separadamente via applyPriceChange
        
        console.log('✅ Dados salvos no SQLite');
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao salvar no SQLite:', error);
        throw error;
    }
}

function saveDataToLocalStorage() {
    console.log('💾 Salvando no localStorage (fallback)...');
    
    try {
        localStorage.setItem('stations', JSON.stringify(gasData));
        localStorage.setItem('users', JSON.stringify(users));
        localStorage.setItem('stationComments', JSON.stringify(stationComments));
        localStorage.setItem('priceHistory', JSON.stringify(priceHistory));
        localStorage.setItem('pendingPrices', JSON.stringify(pendingPrices));
        localStorage.setItem('certifications', JSON.stringify(certifications));
        
        console.log('✅ Dados salvos no localStorage');
    } catch (error) {
        console.error('❌ Erro ao salvar no localStorage:', error);
    }
}

function loadDataFromLocalStorage() {
    console.log('📥 Carregando do localStorage (fallback)...');
    
    try {
        gasData = JSON.parse(localStorage.getItem('stations') || '[]');
        users = JSON.parse(localStorage.getItem('users') || '[]');
        stationComments = JSON.parse(localStorage.getItem('stationComments') || '{}');
        priceHistory = JSON.parse(localStorage.getItem('priceHistory') || '{}');
        pendingPrices = JSON.parse(localStorage.getItem('pendingPrices') || '{}');
        certifications = JSON.parse(localStorage.getItem('certifications') || '{}');
        
        // Usuário atual
        const savedUser = localStorage.getItem('currentUser');
        currentUser = savedUser && savedUser !== 'null' ? JSON.parse(savedUser) : null;
        
        console.log(`✅ Dados carregados do localStorage: ${gasData.length} estações`);
    } catch (error) {
        console.error('❌ Erro ao carregar do localStorage:', error);
        gasData = [];
        users = [];
        stationComments = {};
        priceHistory = {};
        pendingPrices = {};
        certifications = {};
        currentUser = null;
    }
}

// ========== FUNÇÕES AUXILIARES ==========
async function addSampleStations() {
    if (gasData.length === 0) {
        console.log('➕ Adicionando estações de exemplo...');
        
        const sampleStations = [
            {
                id: 'sample_1',
                name: 'Posto Shell',
                coords: [-7.076944, -41.466944],
                prices: { gas: 5.89, etanol: 4.20, diesel: 4.95 },
                isVerified: true,
                trustScore: 8.5,
                type: 'posto'
            },
            {
                id: 'sample_2',
                name: 'Posto Ipiranga',
                coords: [-7.080, -41.470],
                prices: { gas: 5.75, etanol: 4.15, diesel: 4.85 },
                isVerified: false,
                trustScore: 7.2,
                type: 'posto'
            }
        ];
        
        // Adicionar ao array
        gasData.push(...sampleStations);
        
        // Salvar no SQLite
        if (window.sqlDB && sqlDB.initialized) {
            for (const station of sampleStations) {
                await sqlDB.addStation(station);
            }
        }
        
        await saveData();
        console.log('✅ Estações de exemplo adicionadas');
    }
}

function updateStationInGasData(stationId, updates) {
    const index = gasData.findIndex(s => s.id === stationId);
    if (index !== -1) {
        gasData[index] = { ...gasData[index], ...updates };
        return true;
    }
    return false;
}

function syncPostoWithCurrentUser() {
    if (!currentUser || currentUser.type !== 'posto') return;
    
    const station = gasData.find(s => s.id === currentUser.id);
    if (!station) return;
    
    // Sincronizar dados
    if (station.coords && !currentUser.coords) {
        currentUser.coords = station.coords;
    }
    if (station.name && !currentUser.name) {
        currentUser.name = station.name;
    }
    if (station.cnpj && !currentUser.cnpj) {
        currentUser.cnpj = station.cnpj;
    }
    
    console.log('🔄 Dados do posto sincronizados');
}

// ========== EXPORTAR FUNÇÕES GLOBAIS ==========
window.gasData = gasData;
window.users = users;
window.currentUser = currentUser;
window.stationComments = stationComments;
window.priceHistory = priceHistory;
window.pendingPrices = pendingPrices;
window.loadData = loadData;
window.saveData = saveData;
window.addSampleStations = addSampleStations;
window.updateStationInGasData = updateStationInGasData;
window.syncPostoWithCurrentUser = syncPostoWithCurrentUser;
window.locationSelectionContext = locationSelectionContext;
window.fromCadastro = fromCadastro;

console.log('✅ Sistema de dados SQLite inicializado');