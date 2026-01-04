
// Integração do SQL Database no main.js existente

// Modifique a inicialização no main-integration.js
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Iniciando aplicação...');
    
    try {
        // 1. Inicializar SQLite local (sempre)
        console.log('🗃️ Inicializando SQLite local...');
        await initSQLDatabase();
        await loadDataFromSQL();
        
        // 2. Tentar inicializar Firebase (opcional)
        console.log('🔥 Tentando conectar ao Firebase...');
        const firebaseAvailable = isFirebaseAvailable();
        
        if (firebaseAvailable) {
            await initFirebaseSync();
            console.log('✅ Firebase conectado - Modo online/offline ativado');
        } else {
            console.log('⚠️ Firebase não disponível - Modo offline apenas');
        }
        
        // 3. Carregar sistema de comentários
        console.log(`📝 Comentários carregados: ${Object.keys(stationComments).length} postos`);
        
        // 4. Inicializar interface
        setupUI();
        initMap();
        attachEventListeners();
        
        console.log('✅ Aplicação inicializada com sucesso');
        
        // 5. Sincronizar dados se Firebase estiver disponível
        if (firebaseSync) {
            setTimeout(() => {
                firebaseSync.syncAllData();
            }, 3000);
        }
        
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        // Fallback: usar apenas SQLite
        setupUI();
        initMap();
        attachEventListeners();
        showToast('⚠️ Modo offline ativado');
    }
});

// Função para carregar dados do SQL Database
async function loadDataFromSQL() {
  console.log('📂 Carregando dados do SQL Database...');
  
  try {
    if (!window.sqlDB) {
      throw new Error('SQL Database não inicializado');
    }
    
    // Carrega estações
    gasData = await window.sqlDB.getAllStations();
    
    // Carrega usuários
    users = await window.sqlDB.getAllUsers();
    
    // Carrega comentários e organiza por posto
    const allComments = await window.sqlDB.query('SELECT * FROM comments');
    stationComments = {};
    allComments.forEach(comment => {
      if (!stationComments[comment.station_id]) {
        stationComments[comment.station_id] = [];
      }
      stationComments[comment.station_id].push(comment);
    });
    
    // Carrega usuário atual do localStorage (sessão)
    try {
      currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    } catch(e) {
      currentUser = null;
    }
    
    // Carrega preços pendentes
    const pendingResults = await window.sqlDB.query('SELECT * FROM pending_prices');
    pendingPrices = {};
    pendingResults.forEach(pending => {
      pendingPrices[pending.id] = {
        ...pending,
        users: JSON.parse(pending.users || '[]')
      };
    });
    
    // Carrega histórico de preços
    const historyResults = await window.sqlDB.query('SELECT * FROM price_history');
    priceHistory = {};
    historyResults.forEach(record => {
      if (!priceHistory[record.station_id]) {
        priceHistory[record.station_id] = [];
      }
      priceHistory[record.station_id].push(record);
    });
    
    console.log('📊 Dados carregados do SQL:', {
      stations: gasData.length,
      users: users.length,
      currentUser: !!currentUser,
      comments: Object.keys(stationComments).length
    });
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao carregar dados do SQL:', error);
    
    // Fallback para localStorage
    loadDataFromLocalStorage();
    return false;
  }
}

// Função para salvar dados no SQL Database
async function saveDataToSQL() {
  console.log('💾 Salvando dados no SQL Database...');
  
  try {
    if (!window.sqlDB) {
      throw new Error('SQL Database não inicializado');
    }
    
    // Salva usuário atual no localStorage (sessão)
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Salva/atualiza estações
    for (const station of gasData) {
      const existing = await window.sqlDB.getStation(station.id);
      if (existing) {
        await window.sqlDB.updateStation(station);
      } else {
        await window.sqlDB.addStation(station);
      }
    }
    
    // Salva/atualiza usuários
    for (const user of users) {
      const existing = await window.sqlDB.getUser(user.id);
      if (existing) {
        await window.sqlDB.updateUser(user);
      } else {
        await window.sqlDB.addUser(user);
      }
    }
    
    console.log('✅ Dados salvos no SQL Database');
    return true;
  } catch (error) {
    console.error('❌ Erro ao salvar dados no SQL:', error);
    return false;
  }
}

// Modifica a função saveData existente para usar SQL
async function saveData() {
  console.log('💾 saveData() chamado...');
  
  // Salva usuário atual no localStorage (sessão)
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  
  // Decide qual banco de dados usar
  if (window.sqlDB && window.sqlDB.initialized) {
    await saveDataToSQL();
  } else if (typeof saveAllData === 'function') {
    // Fallback para IndexedDB
    await saveAllData();
  } else {
    // Fallback para localStorage
    localStorage.setItem('stations', JSON.stringify(gasData));
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('pendingPrices', JSON.stringify(pendingPrices));
    localStorage.setItem('certifications', JSON.stringify(certifications));
    localStorage.setItem('priceHistory', JSON.stringify(priceHistory));
    saveCommentsToLocalStorage();
  }
}

// Modifica a função addCommentToStation para usar SQL
async function addCommentToStation(stationId, commentData) {
  try {
    // Adicionar ao objeto local
    if (!stationComments[stationId]) {
      stationComments[stationId] = [];
    }
    
    const newComment = {
      ...commentData,
      id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      station_id: stationId,
      date: Date.now()
    };
    
    stationComments[stationId].unshift(newComment);
    
    // Salva no SQL Database se disponível
    if (window.sqlDB && window.sqlDB.initialized) {
      await window.sqlDB.addComment(newComment);
    } else if (typeof dbAddComment === 'function') {
      // Fallback para IndexedDB
      await dbAddComment(newComment);
    }
    
    // Atualizar localStorage (fallback)
    saveCommentsToLocalStorage();
    
    // Recalcular média de avaliações
    updateStationAverageRating(stationId);
    
    return newComment;
  } catch (error) {
    console.error('❌ Erro ao adicionar comentário:', error);
    throw error;
  }
}

// Adiciona botão de administração do SQL Database na UI
function addSQLAdminButton() {
  const existingBtn = document.getElementById('sqlAdminBtn');
  if (existingBtn) existingBtn.remove();
  
  if (window.sqlDB && window.sqlDB.initialized) {
    const sqlBtn = document.createElement('button');
    sqlBtn.id = 'sqlAdminBtn';
    sqlBtn.innerHTML = '<i class="fa-solid fa-database"></i> SQL DB';
    sqlBtn.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 1000;
      background: #9c27b0;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 50%;
      font-weight: bold;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      cursor: pointer;
    `;
    
    sqlBtn.addEventListener('click', function() {
      showSQLAdminPanel();
    });
    
    document.body.appendChild(sqlBtn);
  }
}

// Painel de administração do SQL Database
function showSQLAdminPanel() {
  const panel = document.createElement('div');
  panel.id = 'sqlAdminPanel';
  panel.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border-radius: 10px;
    box-shadow: 0 5px 30px rgba(0,0,0,0.3);
    z-index: 2000;
    width: 400px;
    max-width: 90vw;
  `;
  
  panel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <h3 style="margin: 0; color: #9c27b0;">SQL Database Admin</h3>
      <button onclick="document.getElementById('sqlAdminPanel').remove()" 
              style="background: none; border: none; font-size: 20px; cursor: pointer;">×</button>
    </div>
    
    <div style="margin-bottom: 15px;">
      <button onclick="exportSQLToJSON()" style="width: 100%; padding: 10px; margin: 5px 0; background: #2196f3; color: white; border: none; border-radius: 5px; cursor: pointer;">
        <i class="fa-solid fa-download"></i> Exportar para JSON
      </button>
      
      <button onclick="saveSQLToFile()" style="width: 100%; padding: 10px; margin: 5px 0; background: #4caf50; color: white; border: none; border-radius: 5px; cursor: pointer;">
        <i class="fa-solid fa-save"></i> Salvar em Arquivo
      </button>
      
      <button onclick="backupSQLToLocalStorage()" style="width: 100%; padding: 10px; margin: 5px 0; background: #ff9800; color: white; border: none; border-radius: 5px; cursor: pointer;">
        <i class="fa-solid fa-shield-alt"></i> Backup LocalStorage
      </button>
      
      <input type="file" id="sqlFileInput" accept=".sqlite,.db" style="display: none;" onchange="loadSQLFromFile(event)">
      <button onclick="document.getElementById('sqlFileInput').click()" style="width: 100%; padding: 10px; margin: 5px 0; background: #9c27b0; color: white; border: none; border-radius: 5px; cursor: pointer;">
        <i class="fa-solid fa-upload"></i> Carregar Arquivo
      </button>
    </div>
    
    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
      <h4 style="margin-bottom: 10px;">Consultas SQL</h4>
      <textarea id="sqlQueryInput" rows="4" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;" 
                placeholder="Digite uma consulta SQL...">SELECT * FROM stations LIMIT 5</textarea>
      <button onclick="executeSQLQuery()" style="width: 100%; padding: 10px; margin-top: 10px; background: #607d8b; color: white; border: none; border-radius: 5px; cursor: pointer;">
        Executar Consulta
      </button>
      <pre id="sqlQueryResult" style="background: #f5f5f5; padding: 10px; margin-top: 10px; max-height: 200px; overflow: auto; font-size: 12px;"></pre>
    </div>
    
    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; text-align: center;">
      <button onclick="closeSQLAdminPanel()" style="background: #f44336; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer;">
        Fechar
      </button>
    </div>
  `;
  
  document.body.appendChild(panel);
}

// Funções auxiliares para o painel admin
async function exportSQLToJSON() {
  try {
    const json = await window.sqlDB.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'postos-backup.json';
    a.click();
    
    URL.revokeObjectURL(url);
    showToast('✅ Backup JSON exportado');
  } catch (error) {
    showToast(`❌ Erro: ${error.message}`);
  }
}

async function saveSQLToFile() {
  try {
    await window.sqlDB.saveToFile('postos-app.sqlite');
    showToast('✅ Arquivo SQLite salvo');
  } catch (error) {
    showToast(`❌ Erro: ${error.message}`);
  }
}

async function backupSQLToLocalStorage() {
  try {
    await window.sqlDB.backupToLocalStorage();
    showToast('✅ Backup salvo no localStorage');
  } catch (error) {
    showToast(`❌ Erro: ${error.message}`);
  }
}

async function loadSQLFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    await window.sqlDB.loadFromFile(file);
    showToast('✅ Arquivo carregado com sucesso');
    
    // Recarrega os dados
    await loadDataFromSQL();
    
    // Atualiza a UI
    renderAllMarkers();
  } catch (error) {
    showToast(`❌ Erro: ${error.message}`);
  }
}

async function executeSQLQuery() {
  const query = document.getElementById('sqlQueryInput').value;
  const resultElement = document.getElementById('sqlQueryResult');
  
  try {
    const results = await window.sqlDB.query(query);
    resultElement.textContent = JSON.stringify(results, null, 2);
    resultElement.style.color = '#333';
  } catch (error) {
    resultElement.textContent = `❌ Erro: ${error.message}`;
    resultElement.style.color = '#f44336';
  }
}

function closeSQLAdminPanel() {
  const panel = document.getElementById('sqlAdminPanel');
  if (panel) panel.remove();
}

// Adiciona o botão admin após inicialização
setTimeout(addSQLAdminButton, 2000);
