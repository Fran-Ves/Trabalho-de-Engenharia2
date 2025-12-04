/* data.js — variáveis globais e persistência */

let gasData = [];
let users = [];
let currentUser = null;
let pendingPrices = {};
let certifications = {};
let priceHistory = {};

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

// Sobrescrever a função loadData para usar IndexedDB
async function loadData() {
  console.log('📂 loadData() chamado...');
  
  // Se o IndexedDB estiver disponível, carrega dele
  if (typeof loadAllData === 'function') {
    await loadAllData();
  } else {
    // Fallback para localStorage
    loadDataFromLocalStorage();
  }
  
  console.log('📊 Dados carregados:', {
    stations: gasData.length,
    users: users.length,
    currentUser: !!currentUser
  });
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