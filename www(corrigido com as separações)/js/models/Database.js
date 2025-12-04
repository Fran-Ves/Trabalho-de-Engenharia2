class Database {
    constructor() {
        this.db = null;
        this.dbName = 'PostosAppDB';
        this.dbVersion = 3;
        this.stores = {
            STATIONS: 'stations',
            USERS: 'users',
            ROUTES: 'routes',
            SESSIONS: 'sessions',
            PRICE_HISTORY: 'price_history',
            PENDING_CHANGES: 'pending_changes'
        };
    }

    async init() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB não suportado'));
                return;
            }

            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                this.db = request.result;
                this.migrateFromLocalStorage();
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Criar object stores se não existirem
                if (!db.objectStoreNames.contains(this.stores.STATIONS)) {
                    const store = db.createObjectStore(this.stores.STATIONS, { keyPath: 'id' });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('coords', 'coords', { unique: false });
                    store.createIndex('trustScore', 'trustScore', { unique: false });
                }

                if (!db.objectStoreNames.contains(this.stores.USERS)) {
                    const store = db.createObjectStore(this.stores.USERS, { keyPath: 'id' });
                    store.createIndex('email', 'email', { unique: true });
                }

                if (!db.objectStoreNames.contains(this.stores.ROUTES)) {
                    db.createObjectStore(this.stores.ROUTES, { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains(this.stores.SESSIONS)) {
                    db.createObjectStore(this.stores.SESSIONS, { keyPath: 'type' });
                }

                if (!db.objectStoreNames.contains(this.stores.PRICE_HISTORY)) {
                    const store = db.createObjectStore(this.stores.PRICE_HISTORY, { 
                        keyPath: 'id',
                        autoIncrement: true 
                    });
                    store.createIndex('stationId', 'stationId', { unique: false });
                    store.createIndex('date', 'date', { unique: false });
                }

                if (!db.objectStoreNames.contains(this.stores.PENDING_CHANGES)) {
                    db.createObjectStore(this.stores.PENDING_CHANGES, { keyPath: 'id' });
                }
            };
        });
    }

    async migrateFromLocalStorage() {
        try {
            // VERIFICAÇÃO CRÍTICA: Esperar um pouco para garantir que o banco está pronto
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (!this.db) {
                console.log('Banco de dados não inicializado, pulando migração...');
                return;
            }
            
            // Verificar se as stores existem
            const storeNames = Array.from(this.db.objectStoreNames);
            console.log('Stores disponíveis:', storeNames);
            
            // Se não existir a store de estações, não tente migrar
            if (!storeNames.includes(this.stores.STATIONS)) {
                console.log('Store de estações não criada ainda, pulando migração...');
                return;
            }
            
            // ... resto do método permanece igual ...
        } catch (error) {
            console.error('Erro na migração:', error);
        }
    }

    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName, indexName = null, query = null) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const target = indexName ? store.index(indexName) : store;
            const request = query ? target.getAll(query) : target.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getCurrentUser() {
        const session = await this.get(this.stores.SESSIONS, 'currentUser');
        return session ? session.data : null;
    }

    async setCurrentUser(user) {
        return this.put(this.stores.SESSIONS, {
            type: 'currentUser',
            data: user,
            timestamp: Date.now()
        });
    }

    async clearCurrentUser() {
        return this.delete(this.stores.SESSIONS, 'currentUser');
    }

    async addPriceHistory(stationId, fuelType, price) {
        return this.put(this.stores.PRICE_HISTORY, {
            stationId,
            type: fuelType,
            price: parseFloat(price),
            date: Date.now()
        });
    }

    async getStationPriceHistory(stationId, limit = 10) {
        const all = await this.getAll(this.stores.PRICE_HISTORY, 'stationId', IDBKeyRange.only(stationId));
        return all
            .sort((a, b) => b.date - a.date)
            .slice(0, limit);
    }

    async searchStations(query) {
        const stations = await this.getAll(this.stores.STATIONS);
        const searchTerm = query.toLowerCase().trim();
        
        return stations.filter(station => 
            station.name?.toLowerCase().includes(searchTerm) ||
            station.cnpj?.includes(searchTerm)
        );
    }

    async getStationsNearRoute(routeCoords, radiusMeters = 50) {
        const stations = await this.getAll(this.stores.STATIONS);
        // Implementar lógica de proximidade à rota
        return stations.filter(station => {
            if (!station.coords) return false;
            // Calcular distância à rota (simplificado)
            return true;
        });
    }

    async backupToLocalStorage() {
        // Backup para localStorage como fallback
        try {
            const stations = await this.getAll(this.stores.STATIONS);
            const users = await this.getAll(this.stores.USERS);
            const currentUser = await this.getCurrentUser();

            localStorage.setItem('stations_backup', JSON.stringify(stations));
            localStorage.setItem('users_backup', JSON.stringify(users));
            if (currentUser) {
                localStorage.setItem('currentUser_backup', JSON.stringify(currentUser));
            }
        } catch (error) {
            console.error('Erro no backup:', error);
        }
    }
}

window.Database = Database;