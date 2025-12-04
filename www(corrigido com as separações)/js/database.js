/* database.js — IndexedDB para armazenamento local COM ARQUITETURA ORIENTADA A EVENTOS */

const DB_NAME = 'PostosAppDB';
const DB_VERSION = 3;

const STORES = {
  STATIONS: 'stations',
  USERS: 'users',
  PRICE_HISTORY: 'price_history',
  PENDING_PRICES: 'pending_prices',
  CERTIFICATIONS: 'certifications'
};

// ========== SISTEMA DE EVENTOS ==========
const DatabaseEvents = {
  // Eventos disponíveis
  DB_READY: 'database:ready',
  DB_ERROR: 'database:error',
  DATA_CHANGED: 'data:changed',
  SYNC_STARTED: 'sync:started',
  SYNC_COMPLETED: 'sync:completed',
  SYNC_FAILED: 'sync:failed'
};

// Gerenciador de eventos centralizado
class DatabaseEventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) callbacks.splice(index, 1);
  }

  emit(event, data = null) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Erro no listener do evento ${event}:`, error);
      }
    });
  }

  once(event, callback) {
    const onceWrapper = (data) => {
      callback(data);
      this.off(event, onceWrapper);
    };
    this.on(event, onceWrapper);
  }
}

// Instância global do emissor de eventos
const dbEventEmitter = new DatabaseEventEmitter();

// ========== FUNÇÕES DE BANCO DE DADOS (MANTENDO INTERFACE ORIGINAL) ==========
let db = null;
let dbInitialized = false;
let dbInitializationPromise = null;

// Inicializar/abrir banco (com eventos)
function initDatabase() {
  if (dbInitializationPromise) {
    return dbInitializationPromise;
  }
  
  dbInitializationPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      const error = new Error('IndexedDB não suportado neste navegador');
      dbEventEmitter.emit(DatabaseEvents.DB_ERROR, error);
      reject(error);
      return;
    }
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error('❌ Erro ao abrir banco:', event.target.error);
      dbEventEmitter.emit(DatabaseEvents.DB_ERROR, event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = (event) => {
      db = event.target.result;
      dbInitialized = true;
      console.log('✅ Banco de dados aberto');
      
      // Emitir evento de banco pronto
      dbEventEmitter.emit(DatabaseEvents.DB_READY, db);
      
      // Configurar eventos de erro do banco
      db.onerror = (errEvent) => {
        console.error('❌ Erro no banco de dados:', errEvent.target.error);
        dbEventEmitter.emit(DatabaseEvents.DB_ERROR, errEvent.target.error);
      };
      
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

// Operações CRUD com eventos
function dbAdd(storeName, data) {
  ensureDBReady();
  return new Promise((resolve, reject) => {
    dbEventEmitter.emit(DatabaseEvents.SYNC_STARTED, { storeName, data, operation: 'add' });
    
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(data);
    
    request.onsuccess = () => {
      resolve(request.result);
      dbEventEmitter.emit(DatabaseEvents.DATA_CHANGED, { 
        storeName, 
        data, 
        operation: 'add',
        result: request.result 
      });
      dbEventEmitter.emit(DatabaseEvents.SYNC_COMPLETED, { storeName, operation: 'add' });
    };
    
    request.onerror = (e) => {
      console.error(`❌ Erro ao adicionar em ${storeName}:`, e.target.error);
      dbEventEmitter.emit(DatabaseEvents.SYNC_FAILED, { storeName, error: e.target.error, operation: 'add' });
      reject(e.target.error);
    };
  });
}

function dbPut(storeName, data) {
  ensureDBReady();
  return new Promise((resolve, reject) => {
    dbEventEmitter.emit(DatabaseEvents.SYNC_STARTED, { storeName, data, operation: 'put' });
    
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    
    request.onsuccess = () => {
      resolve(request.result);
      dbEventEmitter.emit(DatabaseEvents.DATA_CHANGED, { 
        storeName, 
        data, 
        operation: 'put',
        result: request.result 
      });
      dbEventEmitter.emit(DatabaseEvents.SYNC_COMPLETED, { storeName, operation: 'put' });
    };
    
    request.onerror = (e) => {
      console.error(`❌ Erro ao atualizar em ${storeName}:`, e.target.error);
      dbEventEmitter.emit(DatabaseEvents.SYNC_FAILED, { storeName, error: e.target.error, operation: 'put' });
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

// Nova função: dbDelete
function dbDelete(storeName, key) {
  ensureDBReady();
  return new Promise((resolve, reject) => {
    dbEventEmitter.emit(DatabaseEvents.SYNC_STARTED, { storeName, key, operation: 'delete' });
    
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    
    request.onsuccess = () => {
      resolve(request.result);
      dbEventEmitter.emit(DatabaseEvents.DATA_CHANGED, { 
        storeName, 
        key, 
        operation: 'delete',
        result: request.result 
      });
      dbEventEmitter.emit(DatabaseEvents.SYNC_COMPLETED, { storeName, operation: 'delete' });
    };
    
    request.onerror = (e) => {
      console.error(`❌ Erro ao deletar de ${storeName}:`, e.target.error);
      dbEventEmitter.emit(DatabaseEvents.SYNC_FAILED, { storeName, error: e.target.error, operation: 'delete' });
      reject(e.target.error);
    };
  });
}

// ========== FUNÇÕES DE ALTO NÍVEL (MANTENDO INTERFACE ORIGINAL) ==========
async function loadAllData() {
  console.log('📂 Carregando dados do IndexedDB...');
  
  try {
    dbEventEmitter.emit(DatabaseEvents.SYNC_STARTED, { operation: 'loadAll' });
    
    const [stations, usersList, historyEntries, pendingEntries, certEntries] = await Promise.all([
      dbGetAll(STORES.STATIONS).catch(() => []),
      dbGetAll(STORES.USERS).catch(() => []),
      dbGetAll(STORES.PRICE_HISTORY).catch(() => []),
      dbGetAll(STORES.PENDING_PRICES).catch(() => []),
      dbGetAll(STORES.CERTIFICATIONS).catch(() => [])
    ]);
    
    // Processar dados
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
    
    dbEventEmitter.emit(DatabaseEvents.DATA_CHANGED, { operation: 'loadAll' });
    dbEventEmitter.emit(DatabaseEvents.SYNC_COMPLETED, { operation: 'loadAll' });
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao carregar dados do IndexedDB, usando fallback:', error);
    
    // Carregar dados de fallback do localStorage
    loadDataFromLocalStorage();
    
    dbEventEmitter.emit(DatabaseEvents.SYNC_FAILED, { error, operation: 'loadAll' });
    return false;
  }
}

async function saveAllData() {
  console.log('💾 Salvando todos os dados no IndexedDB...');
  
  try {
    dbEventEmitter.emit(DatabaseEvents.SYNC_STARTED, { operation: 'saveAll' });
    
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
    
    dbEventEmitter.emit(DatabaseEvents.SYNC_COMPLETED, { operation: 'saveAll' });
    return true;
  } catch (error) {
    console.error('❌ Erro ao salvar dados:', error);
    dbEventEmitter.emit(DatabaseEvents.SYNC_FAILED, { error, operation: 'saveAll' });
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
    
    dbEventEmitter.emit(DatabaseEvents.DATA_CHANGED, { operation: 'localStorageSync' });
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

// ========== API PÚBLICA DE EVENTOS ==========
// Expõe o sistema de eventos para outros módulos que quiserem usar
// MAS NÃO OBRIGA NINGUÉM A USAR - mantém compatibilidade com código existente
const DatabaseAPI = {
  // Funções originais (mantidas para compatibilidade)
  initDatabaseAndLoad,
  loadAllData,
  saveAllData,
  syncWithLocalStorage,
  dbAdd,
  dbPut,
  dbGet,
  dbGetAll,
  dbDelete,
  
  // Sistema de eventos (nova funcionalidade)
  on: (event, callback) => dbEventEmitter.on(event, callback),
  off: (event, callback) => dbEventEmitter.off(event, callback),
  once: (event, callback) => dbEventEmitter.once(event, callback),
  
  // Constantes de eventos
  EVENTS: DatabaseEvents
};

// Para compatibilidade com código existente, exporta funções globais
window.initDatabaseAndLoad = initDatabaseAndLoad;
window.loadAllData = loadAllData;
window.saveAllData = saveAllData;
window.dbPut = dbPut;
window.dbGet = dbGet;
window.dbGetAll = dbGetAll;

// Exporta a API completa se outros módulos quiserem usar eventos
window.DatabaseAPI = DatabaseAPI;