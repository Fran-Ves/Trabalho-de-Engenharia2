/* database.js — IndexedDB para armazenamento local */

const DB_NAME = 'PostosAppDB';
const DB_VERSION = 3;

const STORES = {
  STATIONS: 'stations',
  USERS: 'users',
  PRICE_HISTORY: 'price_history',
  PENDING_PRICES: 'pending_prices',
  CERTIFICATIONS: 'certifications'
};

let db = null;
let dbInitialized = false;
let dbInitializationPromise = null;

// Inicializar/abrir banco (com retry)
function initDatabase() {
  if (dbInitializationPromise) {
    return dbInitializationPromise;
  }
  
  dbInitializationPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.error('❌ IndexedDB não suportado neste navegador');
      reject(new Error('IndexedDB não suportado'));
      return;
    }
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error('❌ Erro ao abrir banco:', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = (event) => {
      db = event.target.result;
      dbInitialized = true;
      console.log('✅ Banco de dados aberto');
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains(STORES.STATIONS)) {
        const store = db.createObjectStore(STORES.STATIONS, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('coords', 'coords', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.USERS)) {
        const store = db.createObjectStore(STORES.USERS, { keyPath: 'id' });
        store.createIndex('email', 'email', { unique: true });
        store.createIndex('cnpj', 'cnpj', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.PRICE_HISTORY)) {
        const store = db.createObjectStore(STORES.PRICE_HISTORY, { 
          keyPath: 'id',
          autoIncrement: true 
        });
        store.createIndex('station_id', 'station_id', { unique: false });
        store.createIndex('date', 'date', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.PENDING_PRICES)) {
        db.createObjectStore(STORES.PENDING_PRICES, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(STORES.CERTIFICATIONS)) {
        db.createObjectStore(STORES.CERTIFICATIONS, { keyPath: 'id' });
      }
      
      console.log(`🔄 Banco criado/atualizado v${event.oldVersion} → v${DB_VERSION}`);
    };
  });
  
  return dbInitializationPromise;
}

// Verificar se o banco está pronto
function ensureDBReady() {
  if (!dbInitialized) {
    throw new Error('Banco de dados não inicializado. Chame initDatabase() primeiro.');
  }
  return db;
}

// Operações CRUD atualizadas
function dbAdd(storeName, data) {
  ensureDBReady();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(data);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => {
      console.error(`❌ Erro ao adicionar em ${storeName}:`, e.target.error);
      reject(e.target.error);
    };
  });
}

function dbPut(storeName, data) {
  ensureDBReady();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => {
      console.error(`❌ Erro ao atualizar em ${storeName}:`, e.target.error);
      reject(e.target.error);
    };
  });
}

function dbGet(storeName, key) {
  ensureDBReady();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function dbGetAll(storeName, indexName = null, query = null) {
  ensureDBReady();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const target = indexName ? store.index(indexName) : store;
    const request = query ? target.getAll(query) : target.getAll();
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => {
      console.error(`❌ Erro ao buscar todos de ${storeName}:`, e.target.error);
      reject(e.target.error);
    };
  });
}

// Carregar todos os dados (com fallback)
async function loadAllData() {
  console.log('📂 Carregando dados do IndexedDB...');
  
  try {
    // Tentar carregar do IndexedDB
    const [stations, usersList, historyEntries, pendingEntries, certEntries] = await Promise.all([
      dbGetAll(STORES.STATIONS).catch(() => []),
      dbGetAll(STORES.USERS).catch(() => []),
      dbGetAll(STORES.PRICE_HISTORY).catch(() => []),
      dbGetAll(STORES.PENDING_PRICES).catch(() => []),
      dbGetAll(STORES.CERTIFICATIONS).catch(() => [])
    ]);
    
    gasData = stations;
    users = usersList;
    
    // Processar histórico de preços
    priceHistory = {};
    historyEntries.forEach(entry => {
      if (!priceHistory[entry.station_id]) {
        priceHistory[entry.station_id] = [];
      }
      priceHistory[entry.station_id].push({
        type: entry.type,
        price: entry.price,
        date: entry.date
      });
    });
    
    // Processar preços pendentes
    pendingPrices = {};
    pendingEntries.forEach(pending => {
      const { id, ...data } = pending;
      pendingPrices[id] = data;
    });
    
    // Processar certificações
    certifications = {};
    certEntries.forEach(cert => {
      const { id, ...data } = cert;
      certifications[id] = data;
    });
    
    // Carregar usuário atual do localStorage (sessão)
    try {
      currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    } catch(e) {
      currentUser = null;
    }
    
    console.log('📊 Dados carregados:', {
      stations: gasData.length,
      users: users.length,
      currentUser: !!currentUser
    });
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao carregar dados do IndexedDB, usando fallback:', error);
    
    // Carregar dados de fallback do localStorage
    loadDataFromLocalStorage();
    return false;
  }
}

// Salvar todos os dados
async function saveAllData() {
  console.log('💾 Salvando todos os dados no IndexedDB...');
  
  try {
    // Salvar estações
    await Promise.all(gasData.map(station => 
      dbPut(STORES.STATIONS, station).catch(err => 
        console.error(`Erro ao salvar station ${station.id}:`, err)
      )
    ));
    
    // Salvar usuários
    await Promise.all(users.map(user => 
      dbPut(STORES.USERS, user).catch(err => 
        console.error(`Erro ao salvar user ${user.id}:`, err)
      )
    ));
    
    console.log('✅ Dados salvos no IndexedDB');
    return true;
  } catch (error) {
    console.error('❌ Erro ao salvar dados:', error);
    return false;
  }
}

// Função para sincronizar com localStorage como backup
function syncWithLocalStorage() {
  try {
    localStorage.setItem('stations', JSON.stringify(gasData));
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    localStorage.setItem('pendingPrices', JSON.stringify(pendingPrices));
    localStorage.setItem('certifications', JSON.stringify(certifications));
    localStorage.setItem('priceHistory', JSON.stringify(priceHistory));
    console.log('🔄 Dados sincronizados com localStorage');
  } catch (error) {
    console.error('❌ Erro ao sincronizar com localStorage:', error);
  }
}

// Inicializar e carregar dados
async function initDatabaseAndLoad() {
  try {
    await initDatabase();
    await loadAllData();
    
    // Sincronizar com localStorage como backup
    syncWithLocalStorage();
    
    // Iniciar sincronização periódica
    setInterval(() => {
      saveAllData();
      syncWithLocalStorage();
    }, 30000);
    
    return true;
  } catch (error) {
    console.error('❌ Falha ao inicializar banco de dados:', error);
    loadDataFromLocalStorage();
    return false;
  }
}