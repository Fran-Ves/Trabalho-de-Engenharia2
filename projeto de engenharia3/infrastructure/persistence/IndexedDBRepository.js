import StationRepository from '../../domain/repositories/StationRepository.js';

export class IndexedDBRepository extends StationRepository {
  constructor(dbName = 'PostosAppDB', version = 3) {
    super();
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('stations')) {
          const store = db.createObjectStore('stations', { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('coords', 'coords', { unique: false });
        }
      };
    });
  }

  async getAll() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['stations'], 'readonly');
      const store = transaction.objectStore('stations');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async save(station) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['stations'], 'readwrite');
      const store = transaction.objectStore('stations');
      const request = store.put(station);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}