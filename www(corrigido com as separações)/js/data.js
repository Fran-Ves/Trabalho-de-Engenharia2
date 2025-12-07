/* data.js — variáveis globais e persistência */

let gasData = [];
let users = [];
let currentUser = null;
let pendingPrices = {};
let certifications = {};
let priceHistory = {};
let stationComments = {};
let locationSelectionContext = null; // 'edit' ou 'cadastro'
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

// Sobrescrever a função loadData para usar IndexedDB
async function loadData() {
  console.log('📂 loadData() chamado...');
  
  // Se o IndexedDB estiver disponível, carrega dele
  if (typeof loadAllData === 'function') {
    await loadAllData();
    await loadAllComments(); // Carrega comentários
  } else {
    // Fallback para localStorage
    loadDataFromLocalStorage();
  }
  
  console.log('📊 Dados carregados:', {
    stations: gasData.length,
    users: users.length,
    currentUser: !!currentUser,
    comments: Object.keys(stationComments).length
  });
}

function saveCommentsToLocalStorage() {
  try {
    localStorage.setItem('stationComments', JSON.stringify(stationComments));
  } catch(e) {
    console.error('❌ Erro ao salvar comentários no localStorage:', e);
  }
}


// Sobrescrever saveData para usar IndexedDB
async function saveData() {
  console.log('💾 saveData() chamado...');
  
  // Salvar usuário atual no localStorage (sessão)
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  
  // Salvar tudo no IndexedDB se disponível
  if (typeof saveAllData === 'function') {
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

// Função para adicionar estações de exemplo
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
    
    // Adicionar ao IndexedDB se disponível
    if (typeof dbPut === 'function') {
      for (const station of sampleStations) {
        await dbPut('stations', station);
      }
    }
    
    // Salvar
    await saveData();
    console.log('✅ Estações de exemplo adicionadas');
  }
}

// Função auxiliar para fallback
function loadDataFromLocalStorage() {
  try {
    gasData = JSON.parse(localStorage.getItem('stations') || '[]');
    users = JSON.parse(localStorage.getItem('users') || '[]');
    currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    pendingPrices = JSON.parse(localStorage.getItem('pendingPrices') || '{}');
    certifications = JSON.parse(localStorage.getItem('certifications') || '{}');
    priceHistory = JSON.parse(localStorage.getItem('priceHistory') || '{}');
  } catch(e) {
    console.error('❌ Erro ao carregar do localStorage:', e);
    gasData = [];
    users = [];
    currentUser = null;
    pendingPrices = {};
    certifications = {};
    priceHistory = {};
  }
}

async function loadAllComments() {
  console.log('📝 Carregando comentários...');
  
  try {
    if (typeof dbGetAllComments === 'function') {
      console.log('📊 Usando IndexedDB para carregar comentários');
      const allComments = await dbGetAllComments();
      
      // Organizar comentários por posto
      stationComments = {};
      allComments.forEach(comment => {
        if (!stationComments[comment.station_id]) {
          stationComments[comment.station_id] = [];
        }
        stationComments[comment.station_id].push(comment);
      });
      
      console.log(`✅ ${allComments.length} comentários carregados do IndexedDB`);
    } else {
      // Fallback para localStorage
      console.log('📊 Usando localStorage (fallback) para carregar comentários');
      try {
        const stored = localStorage.getItem('stationComments');
        stationComments = stored ? JSON.parse(stored) : {};
        console.log(`✅ ${Object.keys(stationComments).length} postos com comentários do localStorage`);
      } catch(e) {
        console.warn('⚠️ Não foi possível carregar comentários do localStorage:', e);
        stationComments = {};
      }
    }
    
    // Tornar global para acesso de outros arquivos
    window.stationComments = stationComments;
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao carregar comentários, usando fallback:', error);
    
    // Fallback extremo
    try {
      const stored = localStorage.getItem('stationComments');
      stationComments = stored ? JSON.parse(stored) : {};
      window.stationComments = stationComments;
    } catch(e) {
      stationComments = {};
      window.stationComments = {};
    }
    
    return false;
  }
}

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
    
    stationComments[stationId].unshift(newComment); // Adiciona no início
    
    // Salvar no IndexedDB se disponível
    if (typeof dbAddComment === 'function') {
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

function updateStationAverageRating(stationId) {
  const comments = stationComments[stationId];
  if (!comments || comments.length === 0) return;
  
  const ratings = comments.filter(c => c.rating).map(c => c.rating);
  if (ratings.length === 0) return;
  
  const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
  
  // Atualizar no posto
  const station = gasData.find(s => s.id === stationId);
  if (station) {
    if (!station.ratings) station.ratings = {};
    station.ratings.average = parseFloat(average.toFixed(1));
    station.ratings.count = ratings.length;
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
    
    // Sincronizar dados do posto com o usuário
    if (station.coords && !currentUser.coords) {
        currentUser.coords = station.coords;
    }
    
    if (station.name && !currentUser.name) {
        currentUser.name = station.name;
    }
    
    if (station.cnpj && !currentUser.cnpj) {
        currentUser.cnpj = station.cnpj;
    }
    
    console.log('🔄 Dados do posto sincronizados com usuário');
}

window.addCommentToStation = addCommentToStation;
window.loadAllComments = loadAllComments;
window.stationComments = stationComments;
window.updateStationInGasData = updateStationInGasData;
window.locationSelectionContext = locationSelectionContext;
window.fromCadastro = fromCadastro;