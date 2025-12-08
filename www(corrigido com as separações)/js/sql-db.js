
/* sql-db.js — Sistema de banco de dados SQL orientado a eventos com SQLite */

const SQLDB_EVENTS = {
  DB_READY: 'sqldb:ready',
  DB_ERROR: 'sqldb:error',
  DATA_CHANGED: 'sqldb:data:changed',
  SYNC_STARTED: 'sqldb:sync:started',
  SYNC_COMPLETED: 'sqldb:sync:completed',
  SYNC_FAILED: 'sqldb:sync:failed',
  QUERY_EXECUTED: 'sqldb:query:executed'
};

class SQLDatabase {
  constructor() {
    this.db = null;
    this.initialized = false;
    this.eventListeners = new Map();
    
    // Mapeamento de tabelas para schema
    this.TABLES = {
      STATIONS: {
        name: 'stations',
        schema: `
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          coords TEXT NOT NULL,
          prices TEXT,
          isVerified INTEGER DEFAULT 0,
          trustScore REAL DEFAULT 5.0,
          type TEXT DEFAULT 'posto',
          cnpj TEXT,
          created_at INTEGER,
          updated_at INTEGER
        `
      },
      USERS: {
        name: 'users',
        schema: `
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          password TEXT,
          cnpj TEXT,
          coords TEXT,
          type TEXT,
          photoUrl TEXT,
          created_at INTEGER,
          updated_at INTEGER
        `
      },
      COMMENTS: {
        name: 'comments',
        schema: `
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          station_id TEXT NOT NULL,
          user_id TEXT,
          user_name TEXT NOT NULL,
          rating INTEGER,
          text TEXT,
          date INTEGER NOT NULL,
          is_public INTEGER DEFAULT 1,
          FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
        `
      },
      PRICE_HISTORY: {
        name: 'price_history',
        schema: `
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          station_id TEXT NOT NULL,
          type TEXT NOT NULL,
          price REAL NOT NULL,
          date INTEGER NOT NULL,
          user_id TEXT,
          FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
        `
      },
      PENDING_PRICES: {
        name: 'pending_prices',
        schema: `
          id TEXT PRIMARY KEY,
          station_id TEXT NOT NULL,
          type TEXT NOT NULL,
          price REAL NOT NULL,
          votes INTEGER DEFAULT 1,
          users TEXT,
          created_at INTEGER,
          FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
        `
      }
    };
    this.autoSaveInterval = null;
    this.autoSaveEnabled = false;
    this.backupKey = 'sqlite_backup_auto';
  }

  // Sistema de eventos
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.eventListeners.has(event)) return;
    const callbacks = this.eventListeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) callbacks.splice(index, 1);
  }

  emit(event, data = null) {
    if (!this.eventListeners.has(event)) return;
    this.eventListeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Erro no listener do evento ${event}:`, error);
      }
    });
  }

  // Inicialização do banco
  async init() {
    try {
      this.emit(SQLDB_EVENTS.SYNC_STARTED, { operation: 'init' });
      
      // Verifica se sql.js está carregado
      if (typeof initSqlJs === 'undefined') {
        throw new Error('SQL.js não carregado. Adicione: <script src="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js"></script>');
      }

      // Carrega SQL.js
      const SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });

        // Cria novo banco de dados
        this.db = new SQL.Database();
        
        // Cria tabelas
        await this.createTables();
        
        this.initialized = true;
        this.emit(SQLDB_EVENTS.DB_READY, this.db);
        this.emit(SQLDB_EVENTS.SYNC_COMPLETED, { operation: 'init' });
      
        try {
            await this.restoreFromLocalStorage(this.backupKey);
            console.log('✅ Backup automático restaurado do localStorage');
        } catch (error) {
            console.log('ℹ️ Nenhum backup automático encontrado');
        }
        this.enableAutoSave(2);
        return this.db;
    } catch (error) {
      console.error('❌ Erro ao inicializar banco SQL:', error);
      this.emit(SQLDB_EVENTS.DB_ERROR, error);
      this.emit(SQLDB_EVENTS.SYNC_FAILED, { operation: 'init', error });
      throw error;
    }
  }

  async createTables() {
    const tables = Object.values(this.TABLES);
    
    for (const table of tables) {
      const createSQL = `CREATE TABLE IF NOT EXISTS ${table.name} (${table.schema})`;
      this.db.run(createSQL);
      
      // Cria índices
      if (table.name === 'comments') {
        this.db.run('CREATE INDEX IF NOT EXISTS idx_comments_station ON comments(station_id)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_comments_date ON comments(date)');
      }
      if (table.name === 'stations') {
        this.db.run('CREATE INDEX IF NOT EXISTS idx_stations_coords ON stations(coords)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_stations_type ON stations(type)');
      }
      if (table.name === 'price_history') {
        this.db.run('CREATE INDEX IF NOT EXISTS idx_price_history_station ON price_history(station_id)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(date)');
      }
    }
    
    console.log('✅ Tabelas SQL criadas');
  }

    enableAutoSave(intervalMinutes = 5) {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        this.autoSaveEnabled = true;
        this.autoSaveInterval = setInterval(() => {
            this.backupToLocalStorage(this.backupKey);
        }, intervalMinutes * 60 * 1000);
        
        console.log(`✅ Autosalvamento habilitado a cada ${intervalMinutes} minutos`);
    }

    disableAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
        this.autoSaveEnabled = false;
        console.log('✅ Autosalvamento desabilitado');
    }



  // Executa consulta SQL
  async query(sql, params = []) {
    this.emit(SQLDB_EVENTS.QUERY_EXECUTED, { sql, params });
    
    try {
      if (typeof params === 'object' && !Array.isArray(params)) {
        // Converte objeto para array na ordem dos placeholders
        params = Object.values(params);
      }
      
      const stmt = this.db.prepare(sql);
      if (params.length > 0) {
        stmt.bind(params);
      }
      
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      
      stmt.free();
      return results;
    } catch (error) {
      console.error('❌ Erro na consulta SQL:', error, sql, params);
      throw error;
    }
  }

  // Executa comando SQL (INSERT, UPDATE, DELETE)
    async run(sql, params = []) {
        this.emit(SQLDB_EVENTS.QUERY_EXECUTED, { sql, params });
        
        try {
            if (typeof params === 'object' && !Array.isArray(params)) {
                params = Object.values(params);
            }
            
            // Converter valores undefined para null ou string vazia
            const safeParams = params.map(param => {
                if (param === undefined) return null;
                if (typeof param === 'object') return JSON.stringify(param);
                return param;
            });
            
            this.db.run(sql, safeParams);
            this.emit(SQLDB_EVENTS.DATA_CHANGED, { sql, params: safeParams });
            return true;
        } catch (error) {
            console.error('❌ Erro ao executar SQL:', error, sql, params);
            throw error;
        }
    }

  // ========== CRUD para Stations ==========
  async addStation(station) {
    const sql = `
      INSERT INTO stations (id, name, coords, prices, isVerified, trustScore, type, cnpj, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      station.id,
      station.name,
      JSON.stringify(station.coords || []),
      JSON.stringify(station.prices || {}),
      station.isVerified ? 1 : 0,
      station.trustScore || 5.0,
      station.type || 'posto',
      station.cnpj || null,
      Date.now(),
      Date.now()
    ];
    
    await this.run(sql, params);
    return station;
  }

  async updateStation(station) {
    const sql = `
      UPDATE stations 
      SET name = ?, coords = ?, prices = ?, isVerified = ?, trustScore = ?, type = ?, cnpj = ?, updated_at = ?
      WHERE id = ?
    `;
    
    const params = [
      station.name,
      JSON.stringify(station.coords || []),
      JSON.stringify(station.prices || {}),
      station.isVerified ? 1 : 0,
      station.trustScore || 5.0,
      station.type || 'posto',
      station.cnpj || null,
      Date.now(),
      station.id
    ];
    
    await this.run(sql, params);
    return station;
  }

  async getStation(id) {
    const results = await this.query('SELECT * FROM stations WHERE id = ?', [id]);
    if (results.length === 0) return null;
    
    const station = results[0];
    return {
      ...station,
      coords: JSON.parse(station.coords),
      prices: JSON.parse(station.prices),
      isVerified: station.isVerified === 1
    };
  }

  async getAllStations(options = {}) {
    let sql = 'SELECT * FROM stations';
    const params = [];
    
    if (options.type) {
      sql += ' WHERE type = ?';
      params.push(options.type);
    }
    
    if (options.sortBy) {
      sql += ` ORDER BY ${options.sortBy} ${options.sortOrder || 'ASC'}`;
    }
    
    const results = await this.query(sql, params);
    return results.map(station => ({
      ...station,
      coords: JSON.parse(station.coords),
      prices: JSON.parse(station.prices),
      isVerified: station.isVerified === 1
    }));
  }

  async deleteStation(id) {
    await this.run('DELETE FROM stations WHERE id = ?', [id]);
    return true;
  }

  async searchStations(query, limit = 20) {
    const sql = `
      SELECT * FROM stations 
      WHERE name LIKE ? OR cnpj LIKE ?
      LIMIT ?
    `;
    
    const searchTerm = `%${query}%`;
    const results = await this.query(sql, [searchTerm, searchTerm, limit]);
    
    return results.map(station => ({
      ...station,
      coords: JSON.parse(station.coords),
      prices: JSON.parse(station.prices),
      isVerified: station.isVerified === 1
    }));
  }

  // ========== CRUD para Users ==========
     async addUser(user) {
        const sql = `
        INSERT INTO users (id, name, email, password, cnpj, coords, type, photoUrl, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            user.id,
            user.name,
            user.email && user.email.trim() !== '' ? user.email : null, // NULL para emails vazios
            user.password || '',
            user.cnpj && user.cnpj.trim() !== '' ? user.cnpj : null, // NULL para CNPJs vazios
            JSON.stringify(user.coords || []),
            user.type || 'user',
            user.photoUrl || '',
            Date.now(),
            Date.now()
        ];
        
        await this.run(sql, params);
        return user;
    }

    async updateUser(user) {
        const sql = `
        UPDATE users 
        SET name = ?, email = ?, password = ?, cnpj = ?, coords = ?, type = ?, photoUrl = ?, updated_at = ?
        WHERE id = ?
        `;
        
        const params = [
        user.name,
        user.email || '',
        user.password || '',
        user.cnpj || '',
        JSON.stringify(user.coords || []),
        user.type || 'user',
        user.photoUrl || '',  // ← Garantir que não seja undefined
        Date.now(),
        user.id
        ];
        
        await this.run(sql, params);
        return user;
    }


  async getUser(id) {
    const results = await this.query('SELECT * FROM users WHERE id = ?', [id]);
    if (results.length === 0) return null;
    
    const user = results[0];
    return {
      ...user,
      coords: JSON.parse(user.coords || '[]')
    };
  }

    async getUserByEmail(email) {
        if (!email || email.trim() === '') {
            return null; // Não busca por emails vazios
        }
        
        const results = await this.query('SELECT * FROM users WHERE email = ?', [email]);
        if (results.length === 0) return null;
        
        const user = results[0];
        return {
            ...user,
            coords: JSON.parse(user.coords || '[]')
        };
    }

    async getUserByCNPJ(cnpj) {
        if (!cnpj || cnpj.trim() === '') {
            return null; // Não busca por CNPJs vazios
        }

        const results = await this.query('SELECT * FROM users WHERE cnpj = ?', [cnpj]);
        if (results.length === 0) return null;

        const user = results[0];
        return {
            ...user,
            coords: JSON.parse(user.coords || '[]')
        };
    }

  async getAllUsers() {
    const results = await this.query('SELECT * FROM users');
    return results.map(user => ({
      ...user,
      coords: JSON.parse(user.coords || '[]')
    }));
  }

  // ========== CRUD para Comments ==========
  async addComment(comment) {
    const sql = `
      INSERT INTO comments (station_id, user_id, user_name, rating, text, date, is_public)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      comment.station_id,
      comment.user_id,
      comment.user_name,
      comment.rating,
      comment.text,
      comment.date || Date.now(),
      comment.is_public ? 1 : 0
    ];
    
    await this.run(sql, params);
    
    // Retorna o comentário com ID
    const results = await this.query('SELECT * FROM comments WHERE rowid = last_insert_rowid()');
    return results[0];
  }

  async getCommentsByStation(stationId, options = {}) {
    let sql = 'SELECT * FROM comments WHERE station_id = ?';
    const params = [stationId];
    
    if (options.orderBy === 'rating') {
      sql += ' ORDER BY rating DESC, date DESC';
    } else {
      sql += ' ORDER BY date DESC';
    }
    
    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    
    return await this.query(sql, params);
  }

  async getAverageRating(stationId) {
    const sql = `
      SELECT 
        AVG(rating) as average,
        COUNT(*) as count
      FROM comments 
      WHERE station_id = ? AND rating IS NOT NULL
    `;
    
    const results = await this.query(sql, [stationId]);
    return results[0] || { average: 0, count: 0 };
  }

  async deleteComment(id) {
    await this.run('DELETE FROM comments WHERE id = ?', [id]);
    return true;
  }

  // ========== CRUD para Price History ==========
  async addPriceHistory(record) {
    const sql = `
      INSERT INTO price_history (station_id, type, price, date, user_id)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const params = [
      record.station_id,
      record.type,
      record.price,
      record.date || Date.now(),
      record.user_id
    ];
    
    await this.run(sql, params);
    return record;
  }

  async getPriceHistory(stationId, limit = 50) {
    const sql = `
      SELECT * FROM price_history 
      WHERE station_id = ? 
      ORDER BY date DESC 
      LIMIT ?
    `;
    
    return await this.query(sql, [stationId, limit]);
  }

  // ========== CRUD para Pending Prices ==========
  async addPendingPrice(pending) {
    const sql = `
      INSERT INTO pending_prices (id, station_id, type, price, votes, users, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      pending.id,
      pending.station_id,
      pending.type,
      pending.price,
      pending.votes || 1,
      JSON.stringify(pending.users || []),
      Date.now()
    ];
    
    await this.run(sql, params);
    return pending;
  }

  async updatePendingPrice(pending) {
    const sql = `
      UPDATE pending_prices 
      SET votes = ?, users = ?
      WHERE id = ?
    `;
    
    const params = [
      pending.votes,
      JSON.stringify(pending.users || []),
      pending.id
    ];
    
    await this.run(sql, params);
    return pending;
  }

  async getPendingPrices(stationId) {
    const sql = 'SELECT * FROM pending_prices WHERE station_id = ?';
    const results = await this.query(sql, [stationId]);
    
    return results.map(pending => ({
      ...pending,
      users: JSON.parse(pending.users || '[]')
    }));
  }

  async deletePendingPrice(id) {
    await this.run('DELETE FROM pending_prices WHERE id = ?', [id]);
    return true;
  }

  // ========== Consultas Avançadas ==========
  async findStationsNearRoute(routeCoords, maxDistance = 50) {
    // Esta é uma simplificação - em produção, use biblioteca espacial
    const stations = await this.getAllStations();
    
    return stations.filter(station => {
      if (!station.coords || station.coords.length !== 2) return false;
      
      // Calcula distância do ponto à linha da rota (simplificado)
      for (let i = 0; i < routeCoords.length - 1; i++) {
        const p1 = routeCoords[i];
        const p2 = routeCoords[i + 1];
        const distance = this.calculateDistanceToSegment(
          station.coords[0], station.coords[1],
          p1.lat, p1.lng,
          p2.lat, p2.lng
        );
        
        if (distance <= maxDistance) return true;
      }
      return false;
    });
  }

  calculateDistanceToSegment(px, py, x1, y1, x2, y2) {
    // Distância do ponto (px,py) ao segmento de linha (x1,y1)-(x2,y2)
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    
    // Retorna distância em metros (aproximada)
    return Math.sqrt(dx * dx + dy * dy) * 111000; // 1 grau ≈ 111km
  }

  async findBestValueStations(limit = 5) {
    const sql = `
      SELECT 
        s.*,
        (10 - CAST(JSON_EXTRACT(prices, '$.gas') AS REAL)) * trustScore as value_score
      FROM stations s
      WHERE JSON_EXTRACT(prices, '$.gas') IS NOT NULL
        AND trustScore >= 6.0
      ORDER BY value_score DESC
      LIMIT ?
    `;
    
    const results = await this.query(sql, [limit]);
    return results.map(station => ({
      ...station,
      coords: JSON.parse(station.coords),
      prices: JSON.parse(station.prices),
      isVerified: station.isVerified === 1,
      isBestValue: true
    }));
  }

  async getStationStats() {
    const sql = `
      SELECT 
        COUNT(*) as total_stations,
        SUM(CASE WHEN isVerified = 1 THEN 1 ELSE 0 END) as verified_stations,
        AVG(trustScore) as avg_trust,
        (SELECT COUNT(*) FROM comments) as total_comments,
        (SELECT COUNT(*) FROM users) as total_users
      FROM stations
    `;
    
    const results = await this.query(sql);
    return results[0] || {};
  }

  // ========== Backup e Restauração ==========
  async exportToJSON() {
    const data = {
      stations: await this.getAllStations(),
      users: await this.getAllUsers(),
      comments: await this.query('SELECT * FROM comments'),
      price_history: await this.query('SELECT * FROM price_history'),
      pending_prices: await this.query('SELECT * FROM pending_prices'),
      export_date: new Date().toISOString()
    };
    
    return JSON.stringify(data, null, 2);
  }

  async importFromJSON(jsonData) {
    const data = JSON.parse(jsonData);
    
    // Limpa tabelas existentes
    await this.run('DELETE FROM pending_prices');
    await this.run('DELETE FROM price_history');
    await this.run('DELETE FROM comments');
    await this.run('DELETE FROM users');
    await this.run('DELETE FROM stations');
    
    // Importa dados
    for (const station of data.stations || []) {
      await this.addStation(station);
    }
    
    for (const user of data.users || []) {
      await this.addUser(user);
    }
    
    for (const comment of data.comments || []) {
      await this.addComment(comment);
    }
    
    for (const price of data.price_history || []) {
      await this.addPriceHistory(price);
    }
    
    for (const pending of data.pending_prices || []) {
      await this.addPendingPrice(pending);
    }
    
    return true;
  }

  // Salva banco de dados em arquivo
  async saveToFile(filename = 'postos-app.sqlite') {
    if (!this.db) throw new Error('Banco de dados não inicializado');
    
    try {
      const data = this.db.export();
      const blob = new Blob([data], { type: 'application/x-sqlite3' });
      
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      
      URL.revokeObjectURL(a.href);
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar arquivo:', error);
      throw error;
    }
  }

  // Carrega banco de dados de arquivo
  async loadFromFile(file) {
    try {
      const buffer = await file.arrayBuffer();
      const SQL = await initSqlJs();
      
      // Fecha banco atual se existir
      if (this.db) {
        this.db.close();
      }
      
      this.db = new SQL.Database(new Uint8Array(buffer));
      this.initialized = true;
      
      this.emit(SQLDB_EVENTS.DB_READY, this.db);
      console.log('✅ Banco de dados carregado do arquivo');
      return true;
    } catch (error) {
      console.error('❌ Erro ao carregar arquivo:', error);
      throw error;
    }
  }

  // Backup automático para localStorage
  async backupToLocalStorage(key = 'sqlite_backup') {
    try {
      const data = this.db.export();
      const binaryString = String.fromCharCode.apply(null, data);
      const base64 = btoa(binaryString);
      
      localStorage.setItem(key, base64);
      console.log('✅ Backup salvo no localStorage');
      return true;
    } catch (error) {
      console.error('❌ Erro no backup:', error);
      return false;
    }
  }

  async restoreFromLocalStorage(key = 'sqlite_backup') {
    try {
      const base64 = localStorage.getItem(key);
      if (!base64) throw new Error('Nenhum backup encontrado');
      
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const SQL = await initSqlJs();
      
      if (this.db) {
        this.db.close();
      }
      
      this.db = new SQL.Database(bytes);
      this.initialized = true;
      
      this.emit(SQLDB_EVENTS.DB_READY, this.db);
      console.log('✅ Backup restaurado do localStorage');
      return true;
    } catch (error) {
      console.error('❌ Erro ao restaurar backup:', error);
      throw error;
    }
  }
}

// Funções auxiliares
async function initSQLDatabase() {
  const sqlDB = new SQLDatabase();
  await sqlDB.init();
  
  // Salva referência global
  window.SQLDatabase = sqlDB;
  window.sqlDB = sqlDB;
  
  return sqlDB;
}

// Sistema de migração do IndexedDB para SQLite
async function migrateFromIndexedDBToSQL() {
  console.log('🔄 Migrando dados do IndexedDB para SQLite...');
  
  const sqlDB = window.sqlDB;
  if (!sqlDB) {
    console.error('❌ SQLDatabase não inicializado');
    return false;
  }
  
  try {
    // Carrega dados do IndexedDB
    await loadAllData(); // Função existente
    
    // Migra estações
    for (const station of gasData) {
      await sqlDB.addStation(station);
    }
    
    // Migra usuários
    for (const user of users) {
      await sqlDB.addUser(user);
    }
    
    // Migra comentários
    for (const stationId in stationComments) {
      for (const comment of stationComments[stationId]) {
        await sqlDB.addComment(comment);
      }
    }
    
    console.log('✅ Migração concluída');
    return true;
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    return false;
  }
}

// Inicialização automática quando disponível
document.addEventListener('DOMContentLoaded', async function() {
  if (typeof initSqlJs !== 'undefined') {
    try {
      await initSQLDatabase();
      console.log('✅ SQL Database pronto para uso');
      
      // Event listeners para integração
      sqlDB.on(SQLDB_EVENTS.DATA_CHANGED, () => {
        console.log('📊 Dados SQL alterados');
      });
      
    } catch (error) {
      console.error('❌ Falha ao inicializar SQL Database:', error);
    }
  }
});

// Exporta para uso global
window.SQLDB_EVENTS = SQLDB_EVENTS;
window.initSQLDatabase = initSQLDatabase;
window.migrateFromIndexedDBToSQL = migrateFromIndexedDBToSQL;
